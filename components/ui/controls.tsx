"use client";

/**
 * Form and feedback primitives. Each one owns its accessibility wiring — the
 * label/description/error relationship, the radiogroup roles, the live region —
 * so screens that use them can't get it wrong.
 */

import { useId, type ReactNode } from "react";
import type { Toast } from "@/hooks/useToast";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ field */

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Receives the ids it must reference. */
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-sand-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <Icon name="warning" size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- segmented */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A radiogroup styled as a segmented control. Arrow keys move between options
 * because only the selected one is in the tab order — the standard pattern.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "light",
}: {
  label: string;
  options: readonly SegmentOption<T>[] | readonly T[];
  value: T;
  onChange: (value: T) => void;
  tone?: "light" | "dark";
}) {
  const items = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o } : (o as SegmentOption<T>),
  );

  const move = (delta: number) => {
    const index = items.findIndex((o) => o.value === value);
    const next = items[(index + delta + items.length) % items.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`segment ${tone === "dark" ? "segment-dark" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {items.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="segment-option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ toast */

const TONE_STYLES = {
  info: "bg-emerald-900 text-sand-50 border-emerald-700",
  success: "bg-emerald-800 text-sand-50 border-gold-500/50",
  error: "bg-danger text-white border-white/25",
} as const;

export function ToastHost({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      {toast && (
        <div
          key={toast.id}
          className={`animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lift ${TONE_STYLES[toast.tone]}`}
        >
          <Icon name={toast.tone === "error" ? "warning" : "check"} size={16} />
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="-mr-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- dialog */

/**
 * Confirmation for destructive actions. Rendered as a real <dialog> so the
 * browser supplies the focus trap, Escape handling, and inert background.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/45 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="animate-rise w-full max-w-sm rounded-xl border border-sand-200 bg-white p-6 shadow-lift"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-sand-600">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-quiet" onClick={onCancel} autoFocus>
            Keep it
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: "var(--color-danger)", color: "#fff" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-full border border-sand-200 bg-white text-gold-500 shadow-plate">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-sand-600">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
