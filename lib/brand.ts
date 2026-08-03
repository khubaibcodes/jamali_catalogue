/**
 * Every brand fact lives here. Change it once, it changes everywhere —
 * the UI, the WhatsApp replies, and the exported cards.
 */

export const brand = {
  name: "JAMAALI",
  tagline: "Fine Eastern Wear",
  purpose: "Catalogue & Rate Book",
  website: "jamaali.com",
  /** Digits only, with country code, no "+" — used to build wa.me links. */
  whatsapp: "923000000000",
  cardFooter: "JAMAALI.COM  ·  ORDER ON WHATSAPP",
} as const;

/** Card + UI palette. Canvas can't read CSS variables, so values live here. */
export const palette = {
  emerald: "#0F4436",
  emeraldDeep: "#071C16",
  emeraldMid: "#186049",
  gold: "#B8944D",
  goldLight: "#E3C88A",
  goldDeep: "#8A6D34",
  ivory: "#FBF8F2",
  paper: "#FFFFFF",
  ink: "#1C2320",
  muted: "#6F7A72",
  line: "#E4DCCB",
  danger: "#9B3535",
  success: "#2F7D57",
} as const;

export const whatsappLink = (message: string) =>
  `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`;
