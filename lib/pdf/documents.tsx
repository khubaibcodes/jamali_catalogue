/* eslint-disable jsx-a11y/alt-text --
 * `Image` here is @react-pdf/renderer's, not the DOM's. It renders into a PDF
 * and has no alt prop to give it; the rule is matching on the name alone.
 */

/**
 * PDF layouts, built with @react-pdf/renderer.
 *
 * Chosen over html2canvas because these pages are mostly type: react-pdf lays
 * out real text, so the result is selectable, searchable and a fraction of the
 * size of a screenshot. Photos are the only raster content.
 *
 * Nothing here may carry a phone number, WhatsApp link or email — these files
 * get forwarded far beyond the shop.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { brand, palette } from "../brand";
import type { ShopArticle } from "../shop";

const A4 = { width: 595.28, height: 841.89 };

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    color: palette.inkSoft,
  },
  coverPage: { backgroundColor: "#FFFFFF", position: "relative" },
  coverImage: { width: A4.width, height: A4.height * 0.68, objectFit: "cover" },
  coverBody: { paddingHorizontal: 44, paddingTop: 28 },
  wordmark: { width: 150, objectFit: "contain", alignSelf: "center" },
  markSmall: { width: 26, height: 26, objectFit: "contain" },

  h1: { fontSize: 26, letterSpacing: 1.5, color: palette.ink, marginBottom: 6 },
  h2: { fontSize: 15, letterSpacing: 1, color: palette.ink, marginBottom: 10 },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 2,
    color: palette.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  rule: { height: 1.5, backgroundColor: palette.amber, width: 56, marginVertical: 12 },

  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
    paddingVertical: 7,
  },
  specTerm: { color: palette.muted, fontSize: 9.5 },
  specValue: { color: palette.ink, fontSize: 9.5 },

  price: { fontSize: 20, color: palette.ink, marginTop: 14 },

  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  swatch: {
    borderWidth: 0.5,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8.5,
    color: palette.inkSoft,
  },

  galleryImage: { width: "100%", height: 640, objectFit: "contain" },
  caption: { fontSize: 8, color: palette.muted, marginTop: 8, textAlign: "center" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: palette.mutedSoft,
    letterSpacing: 0.8,
  },

  // Catalogue grid
  gridRow: { flexDirection: "row", gap: 16, marginBottom: 18 },
  gridCell: { width: "48%" },
  gridImage: { width: "100%", height: 210, objectFit: "cover", borderRadius: 3 },
  gridCode: { fontSize: 10, color: palette.ink, marginTop: 7, letterSpacing: 0.8 },
  gridMeta: { fontSize: 8, color: palette.muted, marginTop: 2 },
  gridPrice: { fontSize: 10, color: palette.ink, marginTop: 3 },

  tocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.line,
  },
});

const rupees = (value: number | null) =>
  value == null ? "On request" : `Rs ${value.toLocaleString("en-PK")}`;

function Footer({ label }: { label?: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{label ?? brand.name}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
      <Text>{brand.website}</Text>
    </View>
  );
}

function Specs({ article }: { article: ShopArticle }) {
  const rows: [string, string][] = [
    ["Article", article.code],
    ["Fabric", article.fabric || "—"],
    ["Pieces", article.pieces],
    ["Stitching", article.stitch],
  ];
  if (article.collection) rows.push(["Collection", article.collection]);
  if (article.category) rows.push(["Category", article.category]);

  return (
    <View>
      {rows.map(([term, value]) => (
        <View style={styles.specRow} key={term}>
          <Text style={styles.specTerm}>{term}</Text>
          <Text style={styles.specValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------ single article ---- */

export function ArticleDocument({
  article,
  logoUrl,
}: {
  article: ShopArticle;
  logoUrl: string;
}) {
  const cover = article.photos[0];
  const title = [article.code, article.name].filter(Boolean).join(" — ");

  return (
    <Document title={title} author={brand.name}>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        {cover && <Image src={cover.url} style={styles.coverImage} />}
        <View style={styles.coverBody}>
          <Image src={logoUrl} style={styles.wordmark} />
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <Text style={styles.h1}>{article.code}</Text>
            {article.name ? (
              <Text style={{ fontSize: 12, color: palette.muted }}>{article.name}</Text>
            ) : null}
            <View style={styles.rule} />
            <Text style={{ fontSize: 9, color: palette.muted, letterSpacing: 1 }}>
              {[article.fabric, article.pieces, article.stitch].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
        </View>
        <Footer label={article.code} />
      </Page>

      {/* Spec sheet */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Specification</Text>
        <Text style={styles.h2}>{title}</Text>
        <View style={styles.rule} />

        <Specs article={article} />

        {article.colours.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.eyebrow}>Colours</Text>
            <View style={styles.swatchRow}>
              {article.colours.map((colour) => (
                <Text key={colour} style={styles.swatch}>
                  {colour}
                </Text>
              ))}
            </View>
          </View>
        )}

        {article.designNotes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.eyebrow}>Design notes</Text>
            <Text style={{ fontSize: 9.5, lineHeight: 1.6, color: palette.inkSoft }}>
              {article.designNotes}
            </Text>
          </View>
        ) : null}

        <Text style={styles.price}>{rupees(article.retail)}</Text>
        <Footer label={article.code} />
      </Page>

      {/* One page per photo */}
      {article.photos.map((photo, index) => (
        <Page size="A4" style={styles.page} key={photo.id}>
          <Image src={photo.url} style={styles.galleryImage} />
          <Text style={styles.caption}>
            {article.code} · photo {index + 1} of {article.photos.length}
          </Text>
          <Footer label={article.code} />
        </Page>
      ))}
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

  // Two per row, six per page keeps images legible without bloating the file.
  const perPage = 6;
  const pages: ShopArticle[][] = [];
  for (let i = 0; i < articles.length; i += perPage) {
    pages.push(articles.slice(i, i + perPage));
  }

  return (
    <Document title={`${brand.name} Catalogue — ${issued}`} author={brand.name}>
      <Page size="A4" style={{ ...styles.page, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Image src={logoUrl} style={{ width: 230, objectFit: "contain" }} />
          <View style={styles.rule} />
          <Text style={{ fontSize: 17, letterSpacing: 5, color: palette.ink, marginTop: 6 }}>
            CATALOGUE
          </Text>
          <Text style={{ fontSize: 10, color: palette.muted, marginTop: 10, letterSpacing: 1.5 }}>
            {issued.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 9, color: palette.mutedSoft, marginTop: 26 }}>
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </Text>
        </View>
      </Page>

      {/* Contents */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Contents</Text>
        <View style={styles.rule} />
        {articles.map((article, index) => (
          <View style={styles.tocRow} key={article.id}>
            <Text style={{ fontSize: 9.5, color: palette.ink }}>
              {article.code}
              {article.name ? `  ·  ${article.name}` : ""}
            </Text>
            <Text style={{ fontSize: 9, color: palette.muted }}>
              {/* Cover + contents occupy the first two sheets. */}
              {Math.floor(index / perPage) + 3}
            </Text>
          </View>
        ))}
        <Footer />
      </Page>

      {pages.map((group, pageIndex) => (
        <Page size="A4" style={styles.page} key={pageIndex}>
          {[0, 2, 4].map((offset) => {
            const pair = group.slice(offset, offset + 2);
            if (!pair.length) return null;
            return (
              <View style={styles.gridRow} key={offset}>
                {pair.map((article) => (
                  <View style={styles.gridCell} key={article.id}>
                    {article.photos[0] && (
                      <Image src={article.photos[0].url} style={styles.gridImage} />
                    )}
                    <Text style={styles.gridCode}>{article.code}</Text>
                    <Text style={styles.gridMeta}>
                      {[article.fabric, article.pieces].filter(Boolean).join(" · ")}
                    </Text>
                    <Text style={styles.gridPrice}>{rupees(article.retail)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
          <Footer />
        </Page>
      ))}
    </Document>
  );
}
