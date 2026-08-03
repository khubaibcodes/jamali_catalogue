"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const DURATION = { info: 2600, success: 2600, error: 5200 } as const;

/**
 * One toast at a time. A new message replaces the old one rather than stacking,
 * which keeps the corner of the screen quiet during rapid actions.
 */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message, tone });
    timer.current = setTimeout(() => setToast(null), DURATION[tone]);
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  /** Runs an async action, reporting whatever error it throws. */
  const attempt = useCallback(
    async (action: () => Promise<void>, success?: string) => {
      try {
        await action();
        if (success) show(success, "success");
      } catch (e) {
        show(e instanceof Error ? e.message : "Something went wrong.", "error");
      }
    },
    [show],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return { toast, show, dismiss, attempt };
}
