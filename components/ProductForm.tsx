"use client";

/**
 * Add / edit an article. The form owns a local draft and only reports upward on
 * submit, so typing never re-renders the catalogue behind it.
 */

import { useRef, useState, type FormEvent } from "react";
import { byteSize, compress, formatBytes } from "@/lib/image";
import { toNumber } from "@/lib/format";
import {
  emptyDraft,
  PIECE_OPTIONS,
  STATUS_OPTIONS,
  STITCH_OPTIONS,
  type Pieces,
  type Product,
  type ProductDraft,
  type Status,
  type Stitch,
} from "@/lib/types";
import { Field, Segmented } from "./ui/controls";
import { Icon } from "./ui/Icon";

const MAX_PHOTOS = 5;

export function ProductForm({
  editing,
  categories,
  collections,
  isCodeTaken,
  onSubmit,
  onCancel,
  onNotify,
}: {
  editing: Product | null;
  categories: string[];
  collections: string[];
  isCodeTaken: (code: string, exceptId?: string) => boolean;
  onSubmit: (draft: ProductDraft) => Promise<void>;
  onCancel: () => void;
  onNotify: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => editing ?? emptyDraft());
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [readingPhotos, setReadingPhotos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setPrice = (tier: keyof ProductDraft["prices"], raw: string) =>
    setDraft((prev) => ({ ...prev, prices: { ...prev.prices, [tier]: toNumber(raw) } }));

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - draft.photos.length;
    if (room <= 0) {
      onNotify(`An article can hold ${MAX_PHOTOS} photos.`, "error");
      return;
    }

    setReadingPhotos(true);
    const accepted: string[] = [];
    let failures = 0;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        accepted.push(await compress(file));
      } catch {
        failures += 1;
      }
    }
    setReadingPhotos(false);

    if (accepted.length) setDraft((prev) => ({ ...prev, photos: [...prev.photos, ...accepted] }));
    if (failures) onNotify(`${failures} photo(s) couldn't be read.`, "error");
    if (fileInput.current) fileInput.current.value = "";
  }

  const removePhoto = (index: number) =>
    setDraft((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));

  /** The cover shot leads the catalogue row and every exported card. */
  const makeCover = (index: number) =>
    setDraft((prev) => {
      const photos = [...prev.photos];
      const [picked] = photos.splice(index, 1);
      return { ...prev, photos: [picked, ...photos] };
    });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = draft.code.trim().toUpperCase();

    if (!code) {
      setCodeError("Every article needs a code — it's what customers quote.");
      return;
    }
    if (isCodeTaken(code, editing?.id)) {
      setCodeError(`${code} is already in the catalogue.`);
      return;
    }

    setCodeError(null);
    setSaving(true);
    try {
      await onSubmit({ ...draft, code });
    } finally {
      setSaving(false);
    }
  }

  const photoBytes = draft.photos.reduce((sum, p) => sum + byteSize(p), 0);

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl pb-24">
      <header className="mb-8">
        <p className="eyebrow">{editing ? "Editing article" : "New article"}</p>
        <h1 className="mt-1 text-3xl">
          {editing ? editing.code : "Add to the catalogue"}
        </h1>
      </header>

      {/* ---------------------------------------------------------- identity */}
      <Section title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Article code"
            hint="Uppercase, unique. This is what a buyer will message you."
            error={codeError ?? undefined}
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="input font-semibold uppercase tracking-wide"
                placeholder="JM-101"
                autoComplete="off"
                value={draft.code}
                onChange={(e) => {
                  set("code", e.target.value);
                  if (codeError) setCodeError(null);
                }}
              />
            )}
          </Field>

          <Field label="Name" hint="Optional — the design name, if it has one.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className="input"
                placeholder="Gulnar"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            )}
          </Field>

          <Field label="Category">
            {({ id }) => (
              <>
                <input
                  id={id}
                  className="input"
                  list="category-options"
                  placeholder="Suit"
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                />
                <datalist id="category-options">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field label="Collection" hint="e.g. Summer Lawn '26. Groups articles together.">
            {({ id, describedBy }) => (
              <>
                <input
                  id={id}
                  aria-describedby={describedBy}
                  className="input"
                  list="collection-options"
                  placeholder="Summer Lawn '26"
                  value={draft.collection}
                  onChange={(e) => set("collection", e.target.value)}
                />
                <datalist id="collection-options">
                  {collections.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------------ fabric */}
      <Section title="The article">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fabric">
            {({ id }) => (
              <input
                id={id}
                className="input"
                placeholder="Lawn, Chiffon, Khaddar…"
                value={draft.fabric}
                onChange={(e) => set("fabric", e.target.value)}
              />
            )}
          </Field>
          <Field label="Colours" hint="Comma separated. Shown on cards and replies.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className="input"
                placeholder="Ivory, Rose, Emerald"
                value={draft.colours}
                onChange={(e) => set("colours", e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="field-label">Stitching</span>
            <Segmented
              label="Stitching"
              options={STITCH_OPTIONS}
              value={draft.stitch}
              onChange={(v) => set("stitch", v as Stitch)}
            />
          </div>
          <div>
            <span className="field-label">Pieces</span>
            <Segmented
              label="Pieces"
              options={PIECE_OPTIONS}
              value={draft.pieces}
              onChange={(v) => set("pieces", v as Pieces)}
            />
          </div>
        </div>

        <div className="mt-4">
          <span className="field-label">Status</span>
          <Segmented
            label="Status"
            options={STATUS_OPTIONS}
            value={draft.status}
            onChange={(v) => set("status", v as Status)}
          />
        </div>
      </Section>

      {/* ------------------------------------------------------------- rates */}
      <Section
        title="Rates"
        note="Leave a rate blank if it doesn't apply. Nothing here is ever shown publicly unless you choose it in the card studio."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceField
            label="Retail"
            placeholder="3,200"
            value={draft.prices.retail}
            onChange={(v) => setPrice("retail", v)}
          />
          <PriceField
            label="Reseller"
            placeholder="2,850"
            value={draft.prices.reseller}
            onChange={(v) => setPrice("reseller", v)}
          />
          <PriceField
            label="Wholesale"
            placeholder="2,450"
            value={draft.prices.wholesale}
            onChange={(v) => setPrice("wholesale", v)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Minimum order" hint="Pieces required to get the wholesale rate.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className="input numeric"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="5"
                value={draft.moq ?? ""}
                onChange={(e) => set("moq", toNumber(e.target.value))}
              />
            )}
          </Field>
          <Field label="Notes" hint="Anything you'd otherwise retype in every reply.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className="input"
                placeholder="Dispatch in 3 days"
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            )}
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------------ photos */}
      <Section
        title="Photos"
        note={
          draft.photos.length
            ? `${draft.photos.length} of ${MAX_PHOTOS} · about ${formatBytes(photoBytes)}`
            : `Up to ${MAX_PHOTOS}. The first is the cover and goes on every card.`
        }
      >
        <div className="flex flex-wrap gap-3">
          {draft.photos.map((photo, index) => (
            <figure
              key={`${index}-${photo.slice(-24)}`}
              className="group relative overflow-hidden rounded-md border border-sand-200 bg-sand-100"
            >
              {/* Data URLs from the user's own device — next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="size-28 object-cover" />

              {index === 0 && (
                <figcaption className="absolute inset-x-0 top-0 bg-emerald-900/85 py-1 text-center text-[0.625rem] font-semibold tracking-widest text-gold-300">
                  COVER
                </figcaption>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-emerald-950/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="rounded p-1 text-sand-50 hover:text-gold-300"
                    title="Make this the cover"
                    aria-label="Make this the cover photo"
                  >
                    <Icon name="sparkle" size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="rounded p-1 text-sand-50 hover:text-danger"
                  title="Remove"
                  aria-label="Remove this photo"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </figure>
          ))}

          {draft.photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={readingPhotos}
              className="grid size-28 place-items-center gap-1 rounded-md border border-dashed border-sand-300 bg-white text-sand-600 transition-colors hover:border-emerald-700 hover:text-emerald-800 disabled:opacity-60"
            >
              <Icon name={readingPhotos ? "image" : "plus"} size={20} />
              <span className="text-xs font-medium">
                {readingPhotos ? "Reading…" : "Add photo"}
              </span>
            </button>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => addPhotos(e.target.files)}
        />
      </Section>

      {/* ------------------------------------------------------------ actions */}
      <div className="sticky bottom-0 -mx-4 mt-10 flex gap-3 border-t border-sand-200 bg-sand-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={saving}>
          <Icon name="check" size={16} />
          {saving ? "Saving…" : editing ? "Save changes" : "Add article"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- helpers */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="plate mb-5 p-5 sm:p-6">
      <h2 className="text-lg">{title}</h2>
      {note && <p className="mt-1 mb-4 text-sm leading-relaxed text-sand-600">{note}</p>}
      <div className={note ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

function PriceField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (raw: string) => void;
}) {
  return (
    <Field label={`${label} (Rs)`}>
      {({ id }) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-sand-300">
            Rs
          </span>
          <input
            id={id}
            className="input numeric pl-10 font-semibold"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </Field>
  );
}
