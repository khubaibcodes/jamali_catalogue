/* eslint-disable jsx-a11y/alt-text --
 * `Image` here is @react-pdf/renderer's, not the DOM's. It renders into a PDF
 * and has no alt prop to give it; the rule is matching on the name alone.
 */

/**
 * Lookbook layouts, built with @react-pdf/renderer.
 *
 * Designed as a print piece rather than a data dump: a cover, an index, then
 * one article per spread on a repeating template so fifty articles feel like
 * one document. Every article shows *all* its photos in saved `position`
 * order, with its full customer-facing spec beside them.
 *
 * Rules that hold everywhere here:
 *  - Type is Helvetica, the built-in face. Registering Montserrat would mean
 *    fetching a TTF at export time, and a failed fetch throws mid-render — not
 *    worth it when the wordmark artwork already carries the brand.
 *  - Images always use objectFit, never a raw width+height pair. objectFit
 *    preserves the aspect ratio; setting both dimensions squashes the picture.
 *  - Videos never appear. A PDF cannot hold one, and the live site plays them.
 *  - No phone number, WhatsApp link or email. These files travel.
 *  - Trade rates never appear. This is a customer document.
 */

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brand, palette } from "../brand";
import type { ShopArticle } from "../shop";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 46;
const CONTENT = A4.width - MARGIN * 2;

/** Photos per gallery page, as a 2×2 grid. */
const GALLERY_PER_PAGE = 4;
/** Thumbnails that fit beside an article's hero before spilling to a gallery. */
const STRIP_MAX = 3;

const s = StyleSheet.create({
  /* ---------------------------------------------------------------- pages */
  page: {
    backgroundColor: "#FFFFFF",
    paddingTop: MARGIN,
    paddingBottom: 62,
    paddingHorizontal: MARGIN,
    fontSize: 9.5,
    color: palette.inkSoft,
    fontFamily: "Helvetica",
  },
  bleedPage: { backgroundColor: "#FFFFFF" },

  /* --------------------------------------------------------------- covers */
  heroBleed: { width: A4.width, height: A4.height * 0.66, objectFit: "cover" },
  coverBelow: { paddingHorizontal: MARGIN, paddingTop: 26, alignItems: "center" },
  wordmarkLg: { width: 190, objectFit: "contain" },
  wordmarkMd: { width: 132, objectFit: "contain" },
  wordmarkSm: { width: 74, objectFit: "contain" },

  /* ------------------------------------------------------------ typography */
  display: { fontSize: 25, letterSpacing: 3, color: palette.ink },
  h2: { fontSize: 14, letterSpacing: 1.4, color: palette.ink },
  name: { fontSize: 11, color: palette.muted, marginTop: 5 },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 2.2,
    color: palette.muted,
    textTransform: "uppercase",
  },
  meta: { fontSize: 8.5, letterSpacing: 1.1, color: palette.muted },
  body: { fontSize: 9, lineHeight: 1.65, color: palette.inkSoft },

  /* ------------------------------------------------------------- fixtures */
  rule: { height: 1.6, width: 46, backgroundColor: palette.amber, marginVertical: 12 },
  ruleWide: { height: 0.6, backgroundColor: palette.line, marginVertical: 12 },

  /* ---------------------------------------------------------------- specs */
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
    paddingVertical: 6,
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
});

/* -------------------------------------------------------------- helpers */

const rupees = (v: number | null) =>
  v == null ? "Price on request" : `Rs ${v.toLocaleString("en-PK")}`;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const titleOf = (a: ShopArticle) => [a.code, a.name].filter(Boolean).join("  ·  ");
const metaOf = (a: ShopArticle) =>
  [a.fabric, a.pieces, a.stitch].filter(Boolean).join("   ·   ");

function RunningHead({ left, right }: { left: string; right?: string }) {
  return (
    <View style={s.header} fixed>
      <Text>{left.toUpperCase()}</Text>
      <Text>{(right ?? "").toUpperCase()}</Text>
    </View>
  );
}

function Footer({ logoUrl }: { logoUrl: string }) {
  return (
    <View style={s.footer} fixed>
      <Image src={logoUrl} style={s.wordmarkSm} />
      <Text style={s.footerText} render={({ pageNumber }) => String(pageNumber)} />
      <Text style={s.footerText}>{brand.website.toUpperCase()}</Text>
    </View>
  );
}

/** A photo in a fixed frame. objectFit keeps the aspect ratio intact. */
function Frame({
  src,
  width,
  height,
  fit = "cover",
}: {
  src: string;
  width: number | string;
  height: number;
  fit?: "cover" | "contain";
}) {
  return (
    <View style={{ width, height, backgroundColor: palette.shell, overflow: "hidden" }}>
      <Image src={src} style={{ width: "100%", height: "100%", objectFit: fit }} />
    </View>
  );
}

/** The spec block, identical on every article so the document reads uniform. */
function Specs({ article, showNotes = true }: { article: ShopArticle; showNotes?: boolean }) {
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
        <View style={{ marginTop: 12 }}>
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

      {showNotes && article.designNotes ? (
        <View style={{ marginTop: 12 }}>
          <Text style={s.eyebrow}>Design notes</Text>
          <Text style={[s.body, { marginTop: 4 }]}>{article.designNotes}</Text>
        </View>
      ) : null}

      <View style={s.ruleWide} />
      <Text style={s.price}>{rupees(article.retail)}</Text>
    </View>
  );
}

/**
 * Gallery pages, 2×2. Only ever called with photos that didn't fit earlier, so
 * an article with many pictures spills onto extra pages instead of clipping.
 */
function GalleryPages({
  article,
  photos,
  logoUrl,
}: {
  article: ShopArticle;
  photos: ShopArticle["photos"];
  logoUrl: string;
}) {
  const cell = (CONTENT - 14) / 2;
  return (
    <>
      {chunk(photos, GALLERY_PER_PAGE).map((group, page) => (
        <Page size="A4" style={s.page} key={`gallery-${page}`}>
          <RunningHead left={article.collection || brand.name} right={article.code} />
          <View style={{ marginTop: 16 }}>
            <Text style={s.eyebrow}>{article.code} · further views</Text>
            <View style={s.rule} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {group.map((photo, i) => (
              <View
                key={photo.id}
                style={{ width: cell, marginRight: i % 2 === 0 ? 14 : 0, marginBottom: 14 }}
              >
                <Frame src={photo.url} width={cell} height={cell * 1.25} />
              </View>
            ))}
          </View>
          <Footer logoUrl={logoUrl} />
        </Page>
      ))}
    </>
  );
}

/* ------------------------------------------------------- single article ---- */

export function ArticleDocument({
  article,
  logoUrl,
}: {
  article: ShopArticle;
  logoUrl: string;
}) {
  const [hero, ...rest] = article.photos;
  const strip = rest.slice(0, STRIP_MAX);
  const overflow = rest.slice(STRIP_MAX);
  const stripCell = (CONTENT - 2 * 10) / 3;

  return (
    <Document title={titleOf(article)} author={brand.name}>
      {/* Cover — the photograph does the talking. */}
      <Page size="A4" style={s.bleedPage}>
        {hero ? (
          <Image src={hero.url} style={s.heroBleed} />
        ) : (
          <View style={{ ...s.heroBleed, backgroundColor: palette.shell }} />
        )}
        <View style={s.coverBelow}>
          <Image src={logoUrl} style={s.wordmarkMd} />
          <View style={s.rule} />
          <Text style={s.display}>{article.code}</Text>
          {article.name ? <Text style={s.name}>{article.name}</Text> : null}
          <Text style={[s.meta, { marginTop: 12 }]}>{metaOf(article)}</Text>
        </View>
      </Page>

      {/* Specification — hero again at a readable size, details beside it. */}
      <Page size="A4" style={s.page}>
        <RunningHead left={article.collection || brand.name} right={article.code} />

        <View style={{ marginTop: 14 }}>
          <Text style={s.eyebrow}>Specification</Text>
          <Text style={[s.h2, { marginTop: 6 }]}>{titleOf(article)}</Text>
          <View style={s.rule} />
        </View>

        <View style={{ flexDirection: "row" }}>
          <View style={{ width: CONTENT * 0.44, marginRight: 18 }}>
            {hero && <Frame src={hero.url} width="100%" height={CONTENT * 0.44 * 1.3} fit="contain" />}
          </View>
          <View style={{ width: CONTENT * 0.5 }}>
            <Specs article={article} />
          </View>
        </View>

        {strip.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={s.eyebrow}>Further views</Text>
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              {strip.map((photo, i) => (
                <View key={photo.id} style={{ marginRight: i < strip.length - 1 ? 10 : 0 }}>
                  <Frame src={photo.url} width={stripCell} height={stripCell * 1.25} />
                </View>
              ))}
            </View>
          </View>
        )}

        <Footer logoUrl={logoUrl} />
      </Page>

      <GalleryPages article={article} photos={overflow} logoUrl={logoUrl} />
    </Document>
  );
}

/* ---------------------------------------------------------- full catalogue */

export function CatalogueDocument({
  articles,
  logoUrl,
}: {
  articles: ShopArticle[];
  logoUrl: string;
}) {
  const issued = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const withPages = paginate(articles);

  const stripCell = (CONTENT * 0.46 - 2 * 8) / 3;

  return (
    <Document title={`${brand.name} Catalogue — ${issued}`} author={brand.name}>
      {/* Cover */}
      <Page size="A4" style={[s.page, { justifyContent: "center", alignItems: "center" }]}>
        <Image src={logoUrl} style={s.wordmarkLg} />
        <View style={s.rule} />
        <Text style={{ fontSize: 15, letterSpacing: 6, color: palette.ink, marginTop: 4 }}>
          CATALOGUE
        </Text>
        <Text style={[s.meta, { marginTop: 14 }]}>{issued.toUpperCase()}</Text>
        <Text style={[s.footerText, { marginTop: 40 }]}>
          {articles.length} {articles.length === 1 ? "ARTICLE" : "ARTICLES"}
        </Text>
      </Page>

      {/* Index, grouped by collection */}
      <Page size="A4" style={s.page}>
        <RunningHead left={brand.name} right="Index" />
        <View style={{ marginTop: 14 }}>
          <Text style={s.eyebrow}>Index</Text>
          <View style={s.rule} />
        </View>

        {groupByCollection(withPages).map(([collection, entries]) => (
          <View key={collection} style={{ marginBottom: 14 }} wrap={false}>
            <Text style={[s.eyebrow, { color: palette.amberDeep }]}>{collection}</Text>
            {entries.map(({ article, startPage }) => (
              <View
                key={article.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                  borderBottomWidth: 0.5,
                  borderBottomColor: palette.line,
                }}
              >
                <Text style={{ fontSize: 9, color: palette.ink }}>
                  {article.code}
                  {article.name ? `   ${article.name}` : ""}
                </Text>
                <Text style={{ fontSize: 8.5, color: palette.muted }}>{startPage}</Text>
              </View>
            ))}
          </View>
        ))}
        <Footer logoUrl={logoUrl} />
      </Page>

      {/* One article per page, same template throughout. */}
      {withPages.map(({ article }) => {
        const [hero, ...rest] = article.photos;
        const strip = rest.slice(0, STRIP_MAX);
        const overflow = rest.slice(STRIP_MAX);

        return (
          <React.Fragment key={article.id}>
            <Page size="A4" style={s.page}>
              <RunningHead left={article.collection || brand.name} right={article.code} />

              <View style={{ marginTop: 14, flexDirection: "row" }}>
                <View style={{ width: CONTENT * 0.46, marginRight: 20 }}>
                  {hero ? (
                    <Frame src={hero.url} width="100%" height={CONTENT * 0.46 * 1.3} />
                  ) : (
                    <View
                      style={{
                        height: CONTENT * 0.46 * 1.3,
                        backgroundColor: palette.shell,
                      }}
                    />
                  )}

                  {strip.length > 0 && (
                    <View style={{ flexDirection: "row", marginTop: 8 }}>
                      {strip.map((photo, i) => (
                        <View
                          key={photo.id}
                          style={{ marginRight: i < strip.length - 1 ? 8 : 0 }}
                        >
                          <Frame src={photo.url} width={stripCell} height={stripCell * 1.25} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={{ width: CONTENT * 0.48 }}>
                  <Text style={s.eyebrow}>{article.collection || "Collection"}</Text>
                  <Text style={[s.h2, { marginTop: 6 }]}>{article.code}</Text>
                  {article.name ? <Text style={s.name}>{article.name}</Text> : null}
                  <View style={s.rule} />
                  <Specs article={article} />
                </View>
              </View>

              <Footer logoUrl={logoUrl} />
            </Page>

            <GalleryPages article={article} photos={overflow} logoUrl={logoUrl} />
          </React.Fragment>
        );
      })}
    </Document>
  );
}

/**
 * Works out which page each article starts on, so the index points somewhere
 * real. Cover and index take the first two sheets; after that an article costs
 * one page plus a gallery page for every four photos that didn't fit beside
 * its hero. Getting this arithmetic wrong is the classic catalogue bug.
 *
 * Kept outside the component: it accumulates, and accumulating during render
 * is exactly what the React Compiler forbids.
 */
function paginate(
  articles: ShopArticle[],
): { article: ShopArticle; startPage: number }[] {
  let cursor = 3;
  const out: { article: ShopArticle; startPage: number }[] = [];
  for (const article of articles) {
    out.push({ article, startPage: cursor });
    const overflow = Math.max(0, article.photos.length - 1 - STRIP_MAX);
    cursor += 1 + Math.ceil(overflow / GALLERY_PER_PAGE);
  }
  return out;
}

function groupByCollection(
  entries: { article: ShopArticle; startPage: number }[],
): [string, { article: ShopArticle; startPage: number }[]][] {
  const groups = new Map<string, { article: ShopArticle; startPage: number }[]>();
  for (const entry of entries) {
    const key = entry.article.collection?.trim() || "Other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()];
}
