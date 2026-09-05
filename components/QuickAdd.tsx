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
  // File and its preview URL are held together so the old URL can always be
  // revoked when it's replaced — an object URL leaks until it is.
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const cameraInput = useRef<HTMLInputElement>(null);
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

  // Mirrors the live preview URL so unmount can revoke it without setState.
  const liveUrl = useRef<string | null>(null);

  /** Swaps the picture, revoking whatever URL it replaces. */
  const pickPhoto = (file: File | null) => {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    liveUrl.current = file ? URL.createObjectURL(file) : null;
    setPhoto(file && liveUrl.current ? { file, url: liveUrl.current } : null);
  };

  // Release the last URL when leaving the page.
  useEffect(
    () => () => {
      if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    },
    [],
  );

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

      if (photo) {
        setStatus({ kind: "saving", step: "Uploading the photo…" });
        const path = await uploadPhoto(supabase, saved.code, photo.file);
        await repo.addPhotoRow(supabase, saved.id, path, 0);
      }

      // Clear only what changes per article. The rack is usually the same kind.
      setCode("");
      setPrice("");
      pickPhoto(null);
      if (cameraInput.current) cameraInput.current.value = "";
      setStatus({ kind: "saved", code: saved.code });
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

      {/* ------------------------------------------------------------ photo */}
      <button
        type="button"
        onClick={() => cameraInput.current?.click()}
        disabled={busy}
        className="relative block aspect-4/5 w-full overflow-hidden rounded-xl border-2 border-dashed border-shell-300 bg-shell-100 transition-colors active:border-ink-700"
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="size-full object-cover" />
            <span className="absolute bottom-3 right-3 rounded-full bg-ink-900/85 px-3 py-1.5 text-xs font-medium text-white">
              Retake
            </span>
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-3 text-shell-600">
            <Icon name="image" size={40} />
            <span className="text-base font-medium">Tap to photograph</span>
            <span className="text-xs">Opens the rear camera</span>
          </span>
        )}
      </button>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        // `capture` asks the phone for the rear camera directly rather than
        // the gallery. Desktop browsers ignore it and show a file picker.
        capture="environment"
        className="sr-only"
        onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
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
