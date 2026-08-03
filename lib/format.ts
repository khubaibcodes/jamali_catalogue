/** Display formatting. Kept tiny and pure so it's easy to trust. */

const PKR = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** `2850` → `"Rs 2,850"`. Anything empty or invalid → an em dash. */
export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rs ${PKR.format(value)}`;
}

/** Parses a form field into a number, treating blank as "not set". */
export function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Joins the parts of a description, skipping anything blank. */
export function joinParts(parts: (string | number | null | undefined)[], sep = " · "): string {
  return parts.filter((p) => p !== null && p !== undefined && String(p).trim() !== "").join(sep);
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
];

/** `"3 days ago"`. Falls back to years. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  let delta = (timestamp - now) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(delta) < size) return RELATIVE.format(Math.round(delta), unit);
    delta /= size;
  }
  return RELATIVE.format(Math.round(delta), "year");
}

/** Turns "JM 101" into a safe filename fragment. */
export function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "article";
}
