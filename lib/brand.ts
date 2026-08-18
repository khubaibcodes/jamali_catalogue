/**
 * Every brand fact lives here. Change it once, it changes everywhere —
 * the UI, the exported cards, and the PDFs.
 *
 * Values are taken from the live jamaali.com storefront: the declared accent
 * (#e8a83e), the Montserrat/Poppins type stack, and the logo artwork now in
 * public/brand/.
 *
 * Deliberately absent: phone numbers, WhatsApp links, email addresses. The
 * public catalogue and the PDFs must carry none, so there is nothing here for
 * them to reach for.
 */

export const brand = {
  name: "JAMAALI",
  tagline: "Fine Eastern Wear",
  purpose: "Catalogue & Rate Book",
  website: "jamaali.com",
  cardFooter: "JAMAALI.COM",
  logo: {
    /** Black serif wordmark with the amber trefoil. Transparent, 1703×518. */
    wordmark: "/brand/jamaali-wordmark.png",
    /** Square mark, 807×807. Used for the app icon and PDF covers. */
    mark: "/brand/jamaali-mark.png",
  },
} as const;

/**
 * Canvas and PDF cannot read CSS variables, so the palette is duplicated here
 * as literals. Keep it in step with the @theme block in app/globals.css.
 */
export const palette = {
  /** The house accent — the trefoil and the full stop in the wordmark. */
  amber: "#E8A83E",
  amberLight: "#F2B168",
  amberDeep: "#C4862A",

  /** Wordmark black, and the storefront's body text colour. */
  ink: "#1A1A1A",
  inkSoft: "#222222",

  /** Dark surface behind the mark on the app tile, and the card studio field. */
  cocoa: "#4A322A",
  cocoaMid: "#5C4034",
  cocoaDeep: "#2E1F1A",

  paper: "#FFFFFF",
  shell: "#F7F7F7",
  line: "#E6E6E6",
  muted: "#696969",
  mutedSoft: "#878787",

  danger: "#B3261E",
  success: "#2F7D57",
} as const;
