"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Check, Close } from "@/components/icons";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{ push: (message: string, tone?: Tone) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pop-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-[14px] shadow-lift",
              toast.tone === "success" && "border-brand/20 bg-white text-ink",
              toast.tone === "error" && "border-danger/25 bg-white text-ink",
              toast.tone === "info" && "border-line bg-white text-ink",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
                toast.tone === "success" && "bg-brand",
                toast.tone === "error" && "bg-danger",
                toast.tone === "info" && "bg-info",
              )}
              aria-hidden="true"
            >
              <Check size={12} strokeWidth={3} />
            </span>
            <p className="leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="ml-1 rounded-full p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"
              aria-label="Dismiss message"
            >
              <Close size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Fires a toast when the server confirms something happened elsewhere on the page. */
export function useActionToast(message: string | null | undefined, tone: Tone = "success") {
  const { push } = useToast();
  const last = useRef<string | null | undefined>(null);
  useEffect(() => {
    if (message && message !== last.current) {
      push(message, tone);
      last.current = message;
    }
  }, [message, push, tone]);
}
