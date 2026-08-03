/**
 * A tiny inline icon set. Hand-drawn on a 24px grid with a 1.6 stroke so the
 * weight matches Inter's — no icon dependency, no font loading, no flash.
 */

const PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  plus: "M12 5v14M5 12h14",
  card: "M4 5h16v14H4zM4 10h16M8 15h5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  edit: "M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16v4Z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5",
  close: "M6 6l12 12M18 6L6 18",
  check: "M4 12.5 9.5 18 20 6.5",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M4 19h16",
  upload: "M12 20V9m0 0 4 4M12 9 8 13M4 5h16",
  whatsapp:
    "M4 20l1.4-4.1A7.7 7.7 0 1 1 8.6 18.6L4 20Zm5.2-9.6c-.2 1 .3 2 1.1 2.9.9.8 1.9 1.3 2.9 1.1l.9-.9 1.6.9-.4 1.1c-1.6.6-3.6-.3-5.2-1.8-1.5-1.6-2.4-3.6-1.8-5.2l1.1-.4.9 1.6-1.1.7Z",
  chevron: "m9 6 6 6-6 6",
  image: "M4 5h16v14H4zM4 16l4.5-4.5L13 16M14 12l2-2 4 4M15.5 8.5h.01",
  sparkle: "M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.3l-1.8-5.7L4.5 10.8 10.2 9z",
  warning: "M12 4 2.5 20h19L12 4ZM12 10v4M12 17.5h.01",
  archive: "M4 6h16v4H4zM6 10v10h12V10M10 14h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
