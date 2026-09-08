/* eslint-disable jsx-a11y/alt-text --
 * `Image` here is @react-pdf/renderer's, not the DOM's. It renders into a PDF
 * and has no alt prop to give it; the rule is matching on the name alone.
 */

/**
 * Lookbook layouts, built with @react-pdf/renderer.
 *
 * Designed as a print piece rather than a data dump: a cover, an index, then
 * one article per page on a repeating template, so fifty articles read as one
 * document. Every article shows *all* its photographs in saved `position`
 * order, with its full customer-facing spec beside them.
 *
 * How the pages are decided
 * -------------------------
 * None of the geometry lives here. lib/pdf/layout.ts plans the whole document
 * first — how tall each photo is, which ones fit where, how many pages the
 * index runs to — and this file only draws the plan. That separation is what
 * fixed the three faults in the first version: grey bands around any photo that
 * wasn't the assumed shape, pages left three-quarters empty, and an index whose
 * page numbers were wrong as soon as the index itself ran past one sheet.
 *
 * Rules that hold everywhere here:
 *  - Type is Helvetica, the built-in face. Registering Montserrat would mean
 *    fetching a TTF at export time, and a failed fetch throws mid-render — not
 *    worth it when the wordmark artwork already carries the brand.
 *  - A photo is never given both a width and a height that disagree with its
 *    aspect ratio. Frames are computed from the picture, so nothing is squashed
 *    and nothing is matted against a grey box.
 *  - Never put `wrap={false}` on a `Page`. It does not mean "don't reflow" —
 *    it makes react-pdf shrink the sheet to its content, so every page comes
 *    out a different physical size and the cover silently falls back to US
 *    Letter. Content is measured against BODY here so it fits an A4 anyway,
 *    which is what keeps the printed folios in step with the index.
 *  - Videos never appear. A PDF cannot hold one, and the live site plays them.
 *  - No phone number, WhatsApp link or email. These files travel.
 *  - Trade rates never appear. This is a customer document.
 */

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand, palette } from "../brand";
import type { ShopArticle } from "../shop";
import type { PdfPhoto, PdfReady } from "./images";
import {
  BODY,
  COLUMN_GAP,
  COLUMN_HEIGHT,
  COVER_BAND,
  COVER_IMAGE,
  GUTTER,
  HERO_COL,
  MARGIN,
  MOSAIC_HEAD,
  SPEC_COL,
  planArticle,
  planIndex,
  stackHeight,
  type ArticlePlan,
  type IndexBlock,
  type Row,
} from "./layout";

/** An article whose photographs have been transcoded and measured. */
export type PdfArticle = PdfReady<ShopArticle>;

/**
 * Longest design note the spec column can hold without pushing the page out of
 * shape. Pages don't reflow here, so an unbounded note would be clipped mid
 * sentence; trimming on a word boundary is the tidier failure.
 */
const NOTE_LIMIT = 300;

const s = StyleSheet.create({
  /* ---------------------------------------------------------------- pages */
  page: {
    backgroundColor: palette.paper,
    paddingTop: MARGIN,
    paddingBottom: 62,
    paddingHorizontal: MARGIN,
    fontSize: 9.5,
    color: palette.inkSoft,
    fontFamily: "Helvetica",
  },
  bleedPage: { backgroundColor: palette.paper, fontFamily: "Helvetica", padding: 0 },

  /* --------------------------------------------------------------- covers */
  /**
   * The cover photograph: full width, running off the top and both sides.
   *
   * Both cover blocks are ordinary flow children with explicit heights that
   * add up to the sheet. An absolutely-positioned overlay would have been
   * tidier to write, but react-pdf measures absolute children when it decides
   * where to break, so a full-height image with a band over it counted as
   * roughly one and a quarter pages and pushed an empty sheet after every
   * cover.
   */
  coverImage: { width: "100%", height: COVER_IMAGE, objectFit: "cover" },
  coverBand: {
    height: COVER_BAND,
    backgroundColor: palette.paper,
    paddingTop: 26,
    paddingHorizontal: MARGIN,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkLg: { width: 190, objectFit: "contain" },
  wordmarkMd: { width: 128, objectFit: "contain" },
  wordmarkSm: { width: 74, objectFit: "contain" },

  /* ------------------------------------------------------------ typography */
  display: { fontSize: 24, letterSpacing: 3, color: palette.ink },
  h2: { fontSize: 14, letterSpacing: 1.4, color: palette.ink },
  name: { fontSize: 11, color: palette.muted, marginTop: 5 },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 2.2,
    color: palette.muted,
    textTransform: "uppercase",
  },
  meta: { fontSize: 8.5, letterSpacing: 1.1, color: palette.muted },
  body: { fontSize: 9, lineHeight: 1.6, color: palette.inkSoft },

  /* ------------------------------------------------------------- fixtures */
  rule: { height: 1.6, width: 46, backgroundColor: palette.amber, marginVertical: 12 },
  ruleWide: { height: 0.6, backgroundColor: palette.line, marginVertical: 11 },

  /* ---------------------------------------------------------------- specs */
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
    paddingVertical: 5.5,
  },
  specTerm: { color: palette.muted, fontSize: 8.5, letterSpacing: 0.5 },
  specValue: { color: palette.ink, fontSize: 9 },

  swatchRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  swatch: {
    borderWidth: 0.6,
    borderColor: palette.line,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
    color: palette.inkSoft,
    marginRight: 4,
    marginBottom: 4,
  },

  price: { fontSize: 17, color: palette.ink, letterSpacing: 0.5 },

  /* -------------------------------------------------------------- running */
  header: {
    position: "absolute",
    top: 22,
    left: MARGIN,
    right: MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    letterSpacing: 1.6,
    color: palette.mutedSoft,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: MARGIN,
    right: MARGIN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, letterSpacing: 1.4, color: palette.mutedSoft },

  /* ---------------------------------------------------------------- index */
  indexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
  },
});

/* -------------------------------------------------------------- helpers */

const rupees = (v: number | null) =>
  v == null ? "Price on request" : `Rs ${v.toLocaleString("en-PK")}`;

const titleOf = (a: PdfArticle) => [a.code, a.name].filter(Boolean).join("  ·  ");
const metaOf = (a: PdfArticle) =>
  [a.fabric, a.pieces, a.stitch].filter(Boolean).join("   ·   ");

/** Trims on a word boundary so a clipped note doesn't end mid-word. */
function trim(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function RunningHead({ left, right }: { left: string; right?: string }) {
  return (
    <View style={s.header} fixed>
      <Text>{left.toUpperCase()}</Text>
      <Text>{(right ?? "").toUpperCase()}</Text>
    </View>
  );
}

function Footer({ logoUrl, folio }: { logoUrl: string; folio: number }) {
  return (
    // `fixed` keeps the footer out of the flow measurement. Without it
    // react-pdf counts it towards the page height and breaks the page early.
    <View style={s.footer} fixed>
      <Image src={logoUrl} style={s.wordmarkSm} />
      {/* The folio is passed in rather than read from react-pdf's own counter:
          it is the same number the index was built from, so the two cannot
          disagree. */}
      <Text style={s.footerText}>{folio}</Text>
      <Text style={s.footerText}>{brand.website.toUpperCase()}</Text>
    </View>
  );
}

/**
 * One justified row of photographs.
 *
 * Widths and heights arrive already solved from the aspect ratios, so each
 * picture is drawn at its own proportions and the row reaches both margins.
 */
function PhotoRow({ row }: { row: Row<PdfPhoto> }) {
  return (
    <View style={{ flexDirection: "row", height: row.height, justifyContent: "center" }}>
      {row.tiles.map((tile, i) => (
        <Image
          key={tile.item.id}
          src={tile.item.url}
          style={{
            width: tile.width,
            height: tile.height,
            marginRight: i < row.tiles.length - 1 ? GUTTER : 0,
            // The dimensions already match the source, so this only absorbs
            // sub-point rounding — it never crops anything visible.
            objectFit: "cover",
          }}
        />
      ))}
    </View>
  );
}

/**
 * A stack of rows filling a known height.
 *
 * When the rows nearly fill the space, the slack is shared out between them so
 * the block reaches the foot of the page. When there is a lot of slack — a page
 * holding one last photograph — spreading it would look accidental, so the
 * stack is centred instead. Either way there is no pool of white at the bottom.
 */
function Mosaic({ rows, available }: { rows: Row<PdfPhoto>[]; available: number }) {
  const natural = stackHeight(rows);
  const spread = rows.length > 1 && natural >= available * 0.7;

  return (
    <View
      style={{
        height: available,
        justifyContent: spread ? "space-between" : "center",
      }}
    >
      {rows.map((row, i) => (
        <View key={row.tiles[0]?.item.id ?? i} style={{ marginBottom: spread ? 0 : i < rows.length - 1 ? GUTTER : 0 }}>
          <PhotoRow row={row} />
        </View>
      ))}
    </View>
  );
}

/** The spec block, identical on every article so the document reads uniform. */
function Specs({ article }: { article: PdfArticle }) {
  const rows: [string, string][] = [
    ["Article", article.code],
    ["Fabric", article.fabric || "—"],
    ["Pieces", article.pieces],
    ["Stitching", article.stitch],
  ];
  if (article.category) rows.push(["Category", article.category]);
  if (article.collection) rows.push(["Collection", article.collection]);
  if (article.status !== "Available") rows.push(["Status", article.status]);

  return (
    <View>
      {rows.map(([term, value]) => (
        <View style={s.specRow} key={term}>
          <Text style={s.specTerm}>{term}</Text>
          <Text style={s.specValue}>{value}</Text>
        </View>
      ))}

      {article.colours.length > 0 && (
        <View style={{ marginTop: 11 }}>
          <Text style={s.eyebrow}>Colours</Text>
          <View style={s.swatchRow}>
            {article.colours.map((colour) => (
              <Text key={colour} style={s.swatch}>
                {colour}
              </Text>
            ))}
          </View>
        </View>
      )}

      {article.designNotes ? (
        <View style={{ marginTop: 11 }}>
          <Text style={s.eyebrow}>Design notes</Text>
          <Text style={[s.body, { marginTop: 4 }]}>
            {trim(article.designNotes, NOTE_LIMIT)}
          </Text>
        </View>
      ) : null}

      <View style={s.ruleWide} />
      <Text style={s.price}>{rupees(article.retail)}</Text>
    </View>
  );
}

/**
 * The article page: heading, then the picture column beside the spec column.
 *
 * The picture column is filled to its full height — hero on top, thumbnails
 * packed underneath — so the page reaches the footer instead of trailing off
 * into white halfway down.
 */
function ArticlePage({
  article,
  plan,
  logoUrl,
  folio,
}: {
  article: PdfArticle;
  plan: ArticlePlan<PdfPhoto>;
  logoUrl: string;
  folio: number;
}) {
  /**
   * How much of the picture column the photographs actually occupy.
   *
   * An article with one photograph physically cannot fill the column — a
   * portrait at this width is about half the page, and stretching it to fit
   * would distort the garment. So the slack is *placed* rather than left to
   * pool above the footer: a nearly-full column is spread to both ends, and a
   * sparse one is centred, which reads as a margin instead of as a page that
   * ran out of content. Both columns move together so the spread stays
   * optically balanced.
   */
  const filled =
    plan.heroHeight +
    (plan.columnRows.length ? GUTTER + stackHeight(plan.columnRows) : 0);
  const spread = plan.columnRows.length > 0 && filled >= COLUMN_HEIGHT * 0.78;

  return (
    <Page size="A4" style={s.page}>
      <RunningHead left={article.collection || brand.name} right={article.code} />

      <View style={{ flexDirection: "row" }}>
        {/* Picture column */}
        <View
          style={{
            width: HERO_COL,
            marginRight: COLUMN_GAP,
            height: COLUMN_HEIGHT,
            justifyContent: spread ? "space-between" : "center",
          }}
        >
          {plan.hero ? (
            <Image
              src={plan.hero.url}
              style={{ width: HERO_COL, height: plan.heroHeight, objectFit: "cover" }}
            />
          ) : (
            <View style={{ width: HERO_COL, height: 240, backgroundColor: palette.shell }} />
          )}

          {plan.columnRows.length > 0 && (
            <View style={{ marginTop: spread ? 0 : GUTTER }}>
              {plan.columnRows.map((row, i) => (
                <View
                  key={row.tiles[0]?.item.id ?? i}
                  style={{ marginBottom: i < plan.columnRows.length - 1 ? GUTTER : 0 }}
                >
                  <PhotoRow row={row} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Spec column */}
        <View
          style={{
            width: SPEC_COL,
            height: COLUMN_HEIGHT,
            justifyContent: spread ? "flex-start" : "center",
          }}
        >
          <View>
            <Text style={s.eyebrow}>{article.collection || brand.tagline}</Text>
            <Text style={[s.h2, { marginTop: 6 }]}>{article.code}</Text>
            {article.name ? <Text style={s.name}>{article.name}</Text> : null}
            <View style={s.rule} />
            <Specs article={article} />
          </View>
        </View>
      </View>

      <Footer logoUrl={logoUrl} folio={folio} />
    </Page>
  );
}

/** Full-width pages for photographs that didn't fit beside the spec. */
function MosaicPages({
  article,
  pages,
  logoUrl,
  firstFolio,
}: {
  article: PdfArticle;
  pages: Row<PdfPhoto>[][];
  logoUrl: string;
  firstFolio: number;
}) {
  return (
    <>
      {pages.map((rows, i) => (
        <Page size="A4" style={s.page} key={`${article.id}-mosaic-${i}`}>
          <RunningHead left={article.collection || brand.name} right={article.code} />
          <View style={{ marginBottom: 14 }}>
            <Text style={s.eyebrow}>
              {article.code} · further views{pages.length > 1 ? ` ${i + 1}/${pages.length}` : ""}
            </Text>
          </View>
          <Mosaic rows={rows} available={BODY - MOSAIC_HEAD} />
          <Footer logoUrl={logoUrl} folio={firstFolio + i} />
        </Page>
      ))}
    </>
  );
}

/* ------------------------------------------------------- single article ---- */

/**
 * One article, as a two-page piece: a full-bleed cover, then the specification
 * page, plus further-views pages only when the photographs actually need them.
 *
 * The cover crops the first photograph to the full sheet and the spec page
 * shows that same photograph uncropped. That repetition is deliberate — the
 * cover is a poster and may cut the garment, so the reader is shown the whole
 * thing once, in proportion, overleaf.
 */
export function ArticleDocument({
  article,
  logoUrl,
}: {
  article: PdfArticle;
  logoUrl: string;
}) {
  const plan = planArticle(article.photos);

  return (
    <Document title={titleOf(article)} author={brand.name}>
      <Page size="A4" style={s.bleedPage}>
        {plan.hero ? (
          <Image src={plan.hero.url} style={s.coverImage} />
        ) : (
          <View style={[s.coverImage, { backgroundColor: palette.shell }]} />
        )}
        <View style={s.coverBand}>
          <Image src={logoUrl} style={s.wordmarkMd} />
          <View style={s.rule} />
          <Text style={s.display}>{article.code}</Text>
          {article.name ? <Text style={s.name}>{article.name}</Text> : null}
          <Text style={[s.meta, { marginTop: 12 }]}>{metaOf(article)}</Text>
        </View>
      </Page>

      <ArticlePage article={article} plan={plan} logoUrl={logoUrl} folio={2} />

      <MosaicPages
        article={article}
        pages={plan.overflowPages}
        logoUrl={logoUrl}
        firstFolio={3}
      />
    </Document>
  );
}

/* ---------------------------------------------------------- full catalogue */

/**
 * The whole published catalogue.
 *
 * Built in two passes, and it has to be in this order: the index cannot cite a
 * page number until it knows how many pages the index itself runs to. So the
 * index is laid out first to learn its own length, and only then are the
 * article page numbers counted and written back into it.
 */
export function CatalogueDocument({
  articles,
  logoUrl,
}: {
  articles: PdfArticle[];
  logoUrl: string;
}) {
  const issued = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const plans = articles.map((article) => ({ article, plan: planArticle(article.photos) }));

  // Pass one — how long is the index?
  const groups = groupByCollection(articles);
  const { pages: indexPages } = planIndex(groups);

  // Pass two — where does each article land, now that the front matter is known?
  const firstArticleFolio = 1 + indexPages.length + 1;
  const folioFor = new Map<string, number>();
  let cursor = firstArticleFolio;
  for (const { article, plan } of plans) {
    folioFor.set(article.id, cursor);
    cursor += plan.pageCount;
  }

  const numbered: IndexBlock<PdfArticle>[][] = indexPages.map((blocks) =>
    blocks.map((block) => ({
      ...block,
      entries: block.entries.map((entry) => ({
        ...entry,
        startPage: folioFor.get(entry.article.id) ?? 0,
      })),
    })),
  );

  const coverPhoto = articles.find((a) => a.photos.length > 0)?.photos[0];

  return (
    <Document title={`${brand.name} Catalogue — ${issued}`} author={brand.name}>
      {/* Cover — the strongest photograph in the book, run to the edges. */}
      <Page size="A4" style={s.bleedPage}>
        {coverPhoto ? (
          <Image src={coverPhoto.url} style={s.coverImage} />
        ) : (
          <View style={[s.coverImage, { backgroundColor: palette.shell }]} />
        )}
        <View style={s.coverBand}>
          <Image src={logoUrl} style={s.wordmarkLg} />
          <View style={s.rule} />
          <Text style={{ fontSize: 14, letterSpacing: 6, color: palette.ink }}>CATALOGUE</Text>
          <Text style={[s.meta, { marginTop: 12 }]}>{issued.toUpperCase()}</Text>
          <Text style={[s.footerText, { marginTop: 10 }]}>
            {articles.length} {articles.length === 1 ? "ARTICLE" : "ARTICLES"}
          </Text>
        </View>
      </Page>

      {/* Index — as many sheets as it needs, page numbers already resolved. */}
      {numbered.map((blocks, page) => (
        <Page size="A4" style={s.page} key={`index-${page}`}>
          <RunningHead left={brand.name} right="Index" />
          <View style={{ marginBottom: 10 }}>
            <Text style={s.eyebrow}>
              Index{numbered.length > 1 ? ` ${page + 1}/${numbered.length}` : ""}
            </Text>
            <View style={s.rule} />
          </View>

          {blocks.map((block, i) => (
            <View key={`${block.collection}-${i}`} style={{ marginTop: i === 0 ? 0 : 12 }}>
              <Text style={[s.eyebrow, { color: palette.amberDeep }]}>
                {block.collection}
                {block.continued ? " (continued)" : ""}
              </Text>
              {block.entries.map(({ article, startPage }) => (
                <View key={article.id} style={s.indexRow}>
                  <Text style={{ fontSize: 9, color: palette.ink }}>
                    {article.code}
                    {article.name ? `   ${article.name}` : ""}
                  </Text>
                  <Text style={{ fontSize: 8.5, color: palette.muted }}>{startPage}</Text>
                </View>
              ))}
            </View>
          ))}

          <Footer logoUrl={logoUrl} folio={page + 2} />
        </Page>
      ))}

      {/* The articles themselves, one template throughout. */}
      {plans.map(({ article, plan }) => {
        const folio = folioFor.get(article.id) ?? 0;
        return (
          <React.Fragment key={article.id}>
            <ArticlePage article={article} plan={plan} logoUrl={logoUrl} folio={folio} />
            <MosaicPages
              article={article}
              pages={plan.overflowPages}
              logoUrl={logoUrl}
              firstFolio={folio + 1}
            />
          </React.Fragment>
        );
      })}
    </Document>
  );
}

function groupByCollection(articles: PdfArticle[]): [string, PdfArticle[]][] {
  const groups = new Map<string, PdfArticle[]>();
  for (const article of articles) {
    const key = article.collection?.trim() || "Other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(article);
    else groups.set(key, [article]);
  }
  return [...groups.entries()];
}
