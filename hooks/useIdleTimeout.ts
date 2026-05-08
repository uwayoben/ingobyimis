"use client";
import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

interface Options {
  idleMs: number;   // total idle time before logout
  warnMs: number;   // how many ms before logout to show the warning
  onWarn: () => void;
  onIdle: () => void;
}

export function useIdleTimeout({ idleMs, warnMs, onWarn, onIdle }: Options) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);

    warnTimer.current = setTimeout(onWarn, idleMs - warnMs);
    idleTimer.current = setTimeout(onIdle, idleMs);
  }, [idleMs, warnMs, onWarn, onIdle]);

  useEffect(() => {
    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return { reset };
}
