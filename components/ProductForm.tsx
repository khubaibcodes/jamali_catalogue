"use client";

/**
 * Add / edit an article.
 *
 * Photos are attached to a saved article rather than held in the draft: an
 * upload needs a row to belong to, and inventing a temporary one would leave
 * orphans behind whenever someone abandoned the form. New articles therefore
 * save first and gain their photo panel immediately afterwards.
 */

import { useRef, useState, type FormEvent } from "react";
import { toNumber } from "@/lib/format";
import {
  emptyDraft,
  PIECE_OPTIONS,
  STATUS_OPTIONS,
  STITCH_OPTIONS,
  type Pieces,
  type Product,
  type ProductDraft,
  type Session,
  type Status,
  type Stitch,
} from "@/lib/types";
import { Field, Segmented } from "./ui/controls";
import { Icon } from "./ui/Icon";

const MAX_PHOTOS = 5;

export function ProductForm({
  editing,
  session,
  categories,
  collections,
  isCodeTaken,
  onSubmit,
  onCancel,
  onAddPhoto,
  onRemovePhoto,
  onMakeCover,
  onNotify,
}: {
  editing: Product | null;
  session: Session;
  categories: string[];
  collections: string[];
  isCodeTaken: (code: string, exceptId?: string) => Promise<boolean>;
  onSubmit: (draft: ProductDraft) => Promise<void>;
  onCancel: () => void;
  // These resolve to the updated product; the form doesn't need it, and
  // `unknown` lets the caller pass its handlers through unwrapped.
  onAddPhoto: (product: Product, file: File) => Promise<unknown>;
  onRemovePhoto: (product: Product, photoId: string) => Promise<unknown>;
  onMakeCover: (product: Product, photoId: string) => Promise<unknown>;
  onNotify: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => editing ?? emptyDraft());
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyPhotos, setBusyPhotos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setPrice = (tier: keyof ProductDraft["prices"], raw: string) =>
    setDraft((prev) => ({ ...prev, prices: { ...prev.prices, [tier]: toNumber(raw) } }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = draft.code.trim().toUpperCase();

    if (!code) {
      setCodeError("Every article needs a code — it's what customers quote.");
      return;
    }

    setSaving(true);
    try {
      if (await isCodeTaken(code, editing?.id)) {
        setCodeError(`${code} is already in the catalogue.`);
        return;
      }
      setCodeError(null);
      await onSubmit({ ...draft, code });
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "Couldn't save that.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !editing) return;
    const room = MAX_PHOTOS - editing.photos.length;
    if (room <= 0) {
      onNotify(`An article can hold ${MAX_PHOTOS} photos.`, "error");
      return;
    }

    setBusyPhotos(true);
    let failures = 0;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        await onAddPhoto(editing, file);
      } catch {
        failures += 1;
      }
    }
    setBusyPhotos(false);
    if (failures) onNotify(`${failures} photo(s) couldn't be uploaded.`, "error");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl pb-24">
      <header className="mb-8">
        <p className="eyebrow">{editing ? "Editing article" : "New article"}</p>
        <h1 className="mt-1 text-3xl">{editing ? editing.code : "Add to the catalogue"}</h1>
      </header>

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
          <Field label="Colours" hint="Type a colour and press Enter. Shown as chips to customers.">
            {({ id, describedBy }) => (
              <ColourInput
                id={id}
                describedBy={describedBy}
                values={draft.colours}
                onChange={(next) => set("colours", next)}
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

      <Section
        title="Rates"
        note={
          session.canSeeTradeRates
            ? "Only the retail price is ever shown to customers. Trade rates stay private to owners."
            : "Retail price only. Trade rates are visible to owners."
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceField
            label="Retail"
            placeholder="3,200"
            value={draft.prices.retail}
            onChange={(v) => setPrice("retail", v)}
          />
          {/* Staff never see these. The database refuses the read regardless,
              so hiding them keeps the interface honest rather than enforcing. */}
          {session.canSeeTradeRates && (
            <>
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
            </>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {session.canSeeTradeRates && (
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
          )}
          <Field label="Internal notes" hint="Staff only. Never reaches the shopfront or a PDF.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                className="input"
                placeholder="Min 5 pcs wholesale"
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Design notes"
            hint="Customer-facing. Embroidery, cut, styling — printed on the article's PDF."
          >
            {({ id, describedBy }) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                className="input min-h-20 resize-y"
                placeholder="Hand-embroidered neckline with rose-gold thread; organza dupatta."
                value={draft.designNotes}
                onChange={(e) => set("designNotes", e.target.value)}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Shopfront" note="Nothing reaches customers until you switch this on.">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-ink-800"
            checked={draft.published}
            onChange={(e) => set("published", e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Show this article in the public catalogue</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-shell-600">
              Customers see the code, fabric, colours, photos and retail price. Trade rates and
              notes are never included.
            </span>
          </span>
        </label>
      </Section>

      <Section
        title="Photos"
        note={
          editing
            ? `${editing.photos.length} of ${MAX_PHOTOS}. The first is the cover and goes on every card.`
            : "Save the article first — photos attach to it once it exists."
        }
      >
        {editing ? (
          <>
            <div className="flex flex-wrap gap-3">
              {editing.photos.map((photo, index) => (
                <figure
                  key={photo.id}
                  className="group relative overflow-hidden rounded-md border border-shell-200 bg-shell-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="size-28 object-cover" />

                  {index === 0 && (
                    <figcaption className="absolute inset-x-0 top-0 bg-ink-900/85 py-1 text-center text-[0.625rem] font-semibold tracking-widest text-amber-300">
                      COVER
                    </figcaption>
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink-950/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => void onMakeCover(editing, photo.id)}
                        className="rounded p-1 text-shell-50 hover:text-amber-300"
                        aria-label="Make this the cover photo"
                      >
                        <Icon name="sparkle" size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void onRemovePhoto(editing, photo.id)}
                      className="rounded p-1 text-shell-50 hover:text-danger"
                      aria-label="Remove this photo"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </figure>
              ))}

              {editing.photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busyPhotos}
                  className="grid size-28 place-items-center gap-1 rounded-md border border-dashed border-shell-300 bg-white text-shell-600 transition-colors hover:border-ink-700 hover:text-ink-800 disabled:opacity-60"
                >
                  <Icon name={busyPhotos ? "image" : "plus"} size={20} />
                  <span className="text-xs font-medium">
                    {busyPhotos ? "Uploading…" : "Add photo"}
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
              onChange={(e) => void addPhotos(e.target.files)}
            />
          </>
        ) : (
          <p className="rounded-md border border-dashed border-shell-300 p-6 text-center text-sm text-shell-600">
            Add the article, then come back to attach its photos.
          </p>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-10 flex gap-3 border-t border-shell-200 bg-shell-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={saving}>
          <Icon name="check" size={16} />
          {saving ? "Saving…" : editing ? "Save changes" : "Add article"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          {editing ? "Done" : "Cancel"}
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
      {note && <p className="mt-1 mb-4 text-sm leading-relaxed text-shell-600">{note}</p>}
      <div className={note ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

/**
 * Colours as chips rather than a comma-separated string.
 *
 * The column is a real text[] now, so "Ivory, Rose" and "Ivory,Rose" can no
 * longer become different values, and the shopfront can render each one.
 */
function ColourInput({
  id,
  describedBy,
  values,
  onChange,
}: {
  id: string;
  describedBy?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState("");

  const commit = (raw: string) => {
    // Accept a pasted comma-separated list in one go.
    const added = raw
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && !values.some((v) => v.toLowerCase() === c.toLowerCase()));
    if (added.length) onChange([...values, ...added]);
    setPending("");
  };

  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((colour) => (
            <li key={colour}>
              <button
                type="button"
                onClick={() => onChange(values.filter((c) => c !== colour))}
                className="flex items-center gap-1.5 rounded-full border border-shell-200 bg-white py-1 pl-3 pr-2 text-xs text-shell-900 hover:border-danger hover:text-danger"
                aria-label={`Remove ${colour}`}
              >
                {colour}
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        aria-describedby={describedBy}
        className="input"
        placeholder="Ivory"
        value={pending}
        onChange={(e) => setPending(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            // Enter must not submit the whole form from inside a chip field.
            e.preventDefault();
            commit(pending);
          } else if (e.key === "Backspace" && !pending && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => pending.trim() && commit(pending)}
      />
    </div>
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
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-shell-300">
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
