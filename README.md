# Jamaali — Catalogue & Rate Book

An internal tool for running the Jamaali article catalogue: keep every suit in
one place with its retail, reseller and wholesale rates, copy a ready-made
WhatsApp reply for any buyer, and export a finished card to post on status or
Instagram.

Everything lives in the browser on one device. There is no server, no account,
and no network call after the page loads.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

---

## The three screens

| Screen        | What it's for                                                          |
| ------------- | ---------------------------------------------------------------------- |
| **Catalogue** | Search, filter and sort articles; copy a per-tier WhatsApp reply        |
| **Add / Edit**| One article: code, fabric, pieces, three rates, up to five photos       |
| **Card studio** | Turn an article into a 1080-wide PNG for WhatsApp status or Instagram |

### Rates are per-tier on purpose

Each article carries three rates — retail, reseller, wholesale. A reply or a
card quotes **exactly one** of them, so a retail customer can never be shown the
wholesale rate by accident. The card studio warns you before printing a reseller
or wholesale rate onto an image.

---

## Where things live

```
lib/          pure logic — no React, safe to unit test
  brand.ts        every brand fact: name, tagline, palette, WhatsApp number
  types.ts        the Product shape and its option lists
  format.ts       money, dates, string joining
  storage.ts      IndexedDB read/write
  image.ts        photo downscaling + a decode cache for the canvas
  whatsapp.ts     reply and rate-list templates, clipboard
  backup.ts       JSON backup/restore, CSV rate sheet
  card/
    canvas.ts     drawing primitives (text fitting, tracking, gold, grain)
    render.ts     card composition and layout

hooks/        state
  useProducts.ts  the single owner of catalogue state
  useToast.ts     transient feedback

components/   presentation
  CatalogueManager.tsx   shell: nav, backup, routing between views
  CatalogueView.tsx      list, search, filters, per-article actions
  ProductForm.tsx        add / edit
  CardStudio.tsx         card controls + live preview + export
  ui/                    Field, Segmented, Toast, ConfirmDialog, EmptyState, Icon

app/
  globals.css   design tokens and component classes (Tailwind v4)
```

The rule: `lib/` never imports React, `components/` never touches storage
directly. If you need new behaviour, it usually belongs in `lib/` with a thin
component on top.

---

## Common changes

**Change the brand, colours, or WhatsApp number** — [`lib/brand.ts`](lib/brand.ts).
It feeds the UI, the replies, and the exported cards.

> ⚠️ `brand.whatsapp` currently holds a placeholder (`923000000000`).
> Replace it with the real number, digits only, country code first, no `+`.

**Restyle the app** — [`app/globals.css`](app/globals.css). Colours, radii and
shadows are tokens in `@theme`; buttons, inputs and badges are component classes
below it. Changing a token restyles everything consistently.

**Change how cards look** — [`lib/card/render.ts`](lib/card/render.ts). The
layout is a top-down flow: header, photo, caption, footer are measured first and
the photo absorbs the leftover height, so both formats stay balanced without
per-format tweaking.

**Add a field to an article** — add it to `Product` and `emptyDraft()` in
[`lib/types.ts`](lib/types.ts), then a `<Field>` in `ProductForm`. Old records
are normalised on restore, so existing backups keep working.

---

## Storage, and the one thing to warn the shop about

Articles are kept in **IndexedDB** under `jamaali-catalogue`. Photos are stored
as downscaled data URLs (max 1400px, WebP where supported), which is why this
isn't `localStorage` — a dozen articles would blow past its ~5 MB ceiling.

**Clearing browser data erases the catalogue.** There is no copy anywhere else.
Use *Download a backup* regularly; it writes a single JSON file containing every
article and photo, and *Restore from a backup* reads it back. The CSV export is
a rate sheet for accountants and printers — it does not include photos and
cannot be restored from.

---

## Notes for whoever picks this up next

- The canvas renderer loads its fonts explicitly before drawing. Canvas does not
  trigger webfont loading the way the DOM does, so skipping this silently
  falls back to a system serif.
- `measure()` in `card/canvas.ts` applies letter-spacing itself before
  measuring. Measuring tracked text without it under-reports the width and lets
  long lines overflow the card.
- Card renders are token-guarded and drawn off-screen, then blitted. Controls
  change faster than a render completes, and only the newest result may land.
- Export re-renders and awaits it before reading pixels, so a PNG can never be
  captured mid-paint.

## Checks

```bash
npm run build
npx tsc --noEmit
npx eslint .
```
