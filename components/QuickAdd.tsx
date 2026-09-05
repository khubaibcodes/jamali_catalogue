"use client";

/**
 * Add one article in about twenty seconds, standing at a rail with a phone.
 *
 * Deliberately not the full ProductForm. That form is thorough — every field,
 * save first then attach photos — which is right at a desk and wrong on a
 * shop floor. Here the photo comes first, only four things are typed, and the
 * shape fields (collection, category, pieces, stitch) persist between saves
 * because a rack of stock is usually all the same kind.
 *
 * It writes to the same `products` / `product_photos` tables through the same
 * repository as everything else. There is no second data model.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as repo from "@/lib/repository";
import { uploadPhoto } from "@/lib/photos";
import { rejectVideo, uploadVideo } from "@/lib/videos";
import { browserClient } from "@/lib/supabase/clients";
import { toNumber } from "@/lib/format";
import {
  emptyDraft,
  PIECE_OPTIONS,
  STITCH_OPTIONS,
  type Pieces,
  type Session,
  type Stitch,
} from "@/lib/types";
import { Icon } from "./ui/Icon";

/** Fields that carry over to the next article, kept on the device. */
const STICKY_KEY = "jamaali-quickadd-sticky";

/** Matches the ceiling the full editor already enforces. */
const MAX_PHOTOS = 8;

/** A picked picture, before it has been uploaded. */
interface Shot {
  id: string;
  file: File;
  url: string;
}

interface Sticky {
  collection: string;
  category: string;
  pieces: Pieces;
  stitch: Stitch;
  fabric: string;
  publish: boolean;
}

const DEFAULT_STICKY: Sticky = {
  collection: "",
  category: "Suit",
  pieces: "3-Piece",
  stitch: "Unstitched",
  fabric: "",
  publish: true,
};

type Status =
  | { kind: "idle" }
  | { kind: "saving"; step: string }
  | { kind: "saved"; code: string }
  | { kind: "error"; message: string };

export function QuickAdd({ session }: { session: Session }) {
  const supabase = useMemo(() => browserClient(), []);

  const [sticky, setSticky] = useState<Sticky>(DEFAULT_STICKY);
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  // Ordered: index 0 is the cover. File and preview URL travel together so the
  // URL can always be revoked — an object URL leaks until it is.
  const [photos, setPhotos] = useState<Shot[]>([]);
  // One clip is plenty for a rail; more is a job for the full editor.
  const [video, setVideo] = useState<Shot | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Two inputs, because one element cannot offer both the camera and a
  // multi-select gallery: `capture` forces the camera and suppresses multiple.
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  /*
   * Restore the sticky fields after mount rather than in a lazy initialiser.
   * localStorage doesn't exist while this renders on the server, and seeding
   * state from it during render would make the server and client HTML differ.
   * Reading it in an effect is the hydration-safe way, so the lint rule is
   * suppressed here deliberately.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STICKY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSticky({ ...DEFAULT_STICKY, ...JSON.parse(saved) });
    } catch {
      // A private window or blocked storage just means defaults.
    }
  }, []);

  const updateSticky = (patch: Partial<Sticky>) => {
    setSticky((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STICKY_KEY, JSON.stringify(next));
      } catch {
        // Not worth interrupting the flow over.
      }
      return next;
    });
  };

  // Every object URL handed out, so unmount can revoke them without setState.
  const liveUrls = useRef<Set<string>>(new Set());

  /** Adds files to the end of the list, first one becoming the cover. */
  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, MAX_PHOTOS);
    const shots: Shot[] = picked.map((file) => {
      const url = URL.createObjectURL(file);
      liveUrls.current.add(url);
      return { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, url };
    });
    setPhotos((prev) => [...prev, ...shots].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (id: string) =>
    setPhotos((prev) =>
      prev.filter((shot) => {
        if (shot.id !== id) return true;
        URL.revokeObjectURL(shot.url);
        liveUrls.current.delete(shot.url);
        return false;
      }),
    );

  /** Promotes a picture to position 0 — the cover used everywhere else. */
  const makeCover = (id: string) =>
    setPhotos((prev) => {
      const picked = prev.find((shot) => shot.id === id);
      return picked ? [picked, ...prev.filter((shot) => shot.id !== id)] : prev;
    });

  const clearMedia = () => {
    for (const url of liveUrls.current) URL.revokeObjectURL(url);
    liveUrls.current.clear();
    setPhotos([]);
    setVideo(null);
  };

  /** Rejects an oversized or unplayable clip before anything is uploaded. */
  const pickVideo = (file: File | null) => {
    if (video) {
      URL.revokeObjectURL(video.url);
      liveUrls.current.delete(video.url);
    }
    if (!file) {
      setVideo(null);
      return;
    }
    const reason = rejectVideo(file);
    if (reason) {
      setStatus({ kind: "error", message: reason });
      setVideo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    liveUrls.current.add(url);
    setVideo({ id: `${file.name}-${file.lastModified}`, file, url });
    setStatus({ kind: "idle" });
  };

  // Release every URL when leaving the page.
  useEffect(() => {
    const urls = liveUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  async function save() {
    const articleCode = code.trim().toUpperCase();
    if (!articleCode) {
      setStatus({ kind: "error", message: "Article number is needed." });
      codeInput.current?.focus();
      return;
    }

    try {
      setStatus({ kind: "saving", step: "Checking the code…" });
      if (await repo.isCodeTaken(supabase, articleCode)) {
        setStatus({ kind: "error", message: `${articleCode} is already in the catalogue.` });
        return;
      }

      setStatus({ kind: "saving", step: "Saving the article…" });
      const saved = await repo.saveProduct(
        supabase,
        {
          ...emptyDraft(),
          code: articleCode,
          fabric: sticky.fabric,
          category: sticky.category,
          collection: sticky.collection,
          pieces: sticky.pieces,
          stitch: sticky.stitch,
          prices: { retail: toNumber(price), reseller: null, wholesale: null },
          published: sticky.publish,
        },
        undefined,
        // Staff must not write trade rates; this mirrors their read permission.
        session.canSeeTradeRates,
      );

      // Uploaded in order so `position` matches what's on screen, index 0
      // being the cover. Sequential rather than parallel: a phone on mobile
      // data handles one large upload far better than six at once.
      let uploaded = 0;
      for (const [index, shot] of photos.entries()) {
        setStatus({
          kind: "saving",
          step: `Uploading photo ${index + 1} of ${photos.length}…`,
        });
        try {
          const path = await uploadPhoto(supabase, saved.code, shot.file);
          await repo.addPhotoRow(supabase, saved.id, path, index);
          uploaded += 1;
        } catch {
          // The article is already saved; losing one picture must not discard
          // the rest or the typing. Report it and carry on.
        }
      }

      let videoFailed = false;
      if (video) {
        setStatus({ kind: "saving", step: "Uploading the video…" });
        try {
          const path = await uploadVideo(supabase, saved.code, video.file);
          await repo.addVideoRow(supabase, saved.id, path, 0);
        } catch {
          // Same rule as photos: the article is saved, so one failed clip must
          // not throw away the typing.
          videoFailed = true;
        }
      }

      const missed = photos.length - uploaded + (videoFailed ? 1 : 0);

      // Clear only what changes per article. The rack is usually the same kind.
      setCode("");
      setPrice("");
      clearMedia();
      if (cameraInput.current) cameraInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
      if (videoInput.current) videoInput.current.value = "";

      if (missed > 0) {
        setStatus({
          kind: "error",
          message: `${saved.code} saved, but ${missed} file(s) failed to upload. Add them from the article list.`,
        });
      } else {
        setStatus({ kind: "saved", code: saved.code });
      }
      codeInput.current?.focus();
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Couldn't save that.",
      });
    }
  }

  const busy = status.kind === "saving";

  return (
    <main className="mx-auto max-w-lg px-4 pb-32 pt-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow">Quick add</p>
          <h1 className="mt-0.5 text-2xl">New article</h1>
        </div>
        <Link href="/admin" className="btn btn-quiet btn-sm">
          <Icon name="grid" size={15} />
          All articles
        </Link>
      </header>

      {/* ----------------------------------------------------------- photos */}
      {photos.length === 0 ? (
        <div className="grid aspect-4/5 w-full place-items-center rounded-xl border-2 border-dashed border-shell-300 bg-shell-100 text-shell-600">
          <div className="text-center">
            <Icon name="image" size={40} className="mx-auto" />
            <p className="mt-3 text-base font-medium">No photos yet</p>
            <p className="mt-1 text-xs">Shoot one, or pick several from the gallery</p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((shot, index) => (
            <li key={shot.id} className="relative">
              <div className="aspect-4/5 overflow-hidden rounded-lg border border-shell-200 bg-shell-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.url} alt="" className="size-full object-cover" />
              </div>

              {index === 0 && (
                <span className="absolute inset-x-0 top-0 rounded-t-lg bg-ink-900/85 py-1 text-center text-[0.5625rem] font-semibold tracking-widest text-amber-300">
                  COVER
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b-lg bg-ink-950/75 py-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(shot.id)}
                    disabled={busy}
                    aria-label={`Make photo ${index + 1} the cover`}
                    className="rounded p-1.5 text-white active:text-amber-300"
                  >
                    <Icon name="sparkle" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(shot.id)}
                  disabled={busy}
                  aria-label={`Remove photo ${index + 1}`}
                  className="rounded p-1.5 text-white active:text-danger"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
          className="btn btn-primary h-14"
        >
          <Icon name="image" size={17} />
          Take photo
        </button>
        <button
          type="button"
          onClick={() => galleryInput.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
          className="btn btn-quiet h-14"
        >
          <Icon name="copy" size={17} />
          From gallery
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-shell-500">
        {photos.length
          ? `${photos.length} of ${MAX_PHOTOS} · first one is the cover`
          : `Up to ${MAX_PHOTOS}. The first is the cover.`}
      </p>

      {/*
        Two inputs rather than one. `capture` forces the camera *and* makes the
        browser ignore `multiple`, so a single element cannot offer both
        "shoot one now" and "pick several from the gallery".
      */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = "";
        }}
      />

      {/* ------------------------------------------------------------ video */}
      <section className="plate mt-5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Video</h2>
            <p className="mt-0.5 text-xs text-shell-600">
              Optional · plays on the website only, never in a PDF
            </p>
          </div>
          {!video && (
            <button
              type="button"
              onClick={() => videoInput.current?.click()}
              disabled={busy}
              className="btn btn-quiet btn-sm"
            >
              <Icon name="plus" size={15} />
              Add clip
            </button>
          )}
        </div>

        {video && (
          <div className="mt-3">
            <video
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-lg bg-ink-950"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-shell-600">
                {(video.file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => pickVideo(null)}
                disabled={busy}
                className="btn btn-danger btn-sm"
              >
                <Icon name="trash" size={14} />
                Remove
              </button>
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-shell-500">Up to 25 MB. MP4 or MOV.</p>
      </section>

      {/*
        No `capture` here on purpose: leaving it off lets the phone offer both
        the camera and the gallery, which is the choice people expect for video.
      */}
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(e) => {
          pickVideo(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {/* --------------------------------------------------- typed per item */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Article no.</span>
          <input
            ref={codeInput}
            className="input h-14 text-lg font-semibold uppercase"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="JM-101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="field-label">Price (Rs)</span>
          <input
            className="input numeric h-14 text-lg font-semibold"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="4000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>

      {/* ------------------------------------------------ carried over */}
      <section className="plate mt-5 p-4">
        <p className="mb-3 text-xs text-shell-600">
          These stay for the next article — set them once per rack.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Fabric</span>
            <input
              className="input h-12"
              placeholder="Lawn"
              value={sticky.fabric}
              onChange={(e) => updateSticky({ fabric: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">Collection</span>
            <input
              className="input h-12"
              placeholder="Summer"
              value={sticky.collection}
              onChange={(e) => updateSticky({ collection: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-3">
          <span className="field-label">Pieces</span>
          <div className="grid grid-cols-4 gap-1.5">
            {PIECE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option.replace("-Piece", "")}
                selected={sticky.pieces === option}
                onClick={() => updateSticky({ pieces: option })}
              />
            ))}
          </div>
        </div>

        <div className="mt-3">
          <span className="field-label">Stitching</span>
          <div className="grid grid-cols-2 gap-1.5">
            {STITCH_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={sticky.stitch === option}
                onClick={() => updateSticky({ stitch: option })}
              />
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-shell-100 p-3">
          <span className="text-sm">
            <span className="font-medium">Show to customers</span>
            <span className="mt-0.5 block text-xs text-shell-600">
              {sticky.publish ? "Goes live within a minute" : "Saved as a draft"}
            </span>
          </span>
          <input
            type="checkbox"
            className="size-6 shrink-0 accent-ink-800"
            checked={sticky.publish}
            onChange={(e) => updateSticky({ publish: e.target.checked })}
          />
        </label>
      </section>

      {/* ------------------------------------------------------- save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-shell-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {status.kind === "saved" && (
            <p className="mb-2 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
              <Icon name="check" size={16} />
              {status.code} added. Ready for the next one.
            </p>
          )}
          {status.kind === "error" && (
            <p
              role="alert"
              className="mb-2 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
            >
              <Icon name="warning" size={16} />
              {status.message}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn btn-primary h-14 w-full text-base"
          >
            {busy ? status.step : "Save article"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
        selected
          ? "border-ink-800 bg-ink-800 text-white"
          : "border-shell-200 bg-white text-shell-600"
      }`}
    >
      {label}
    </button>
  );
}
