"use client";

import { useEffect } from "react";

/**
 * Reports a crash once. Kept in one place so every boundary behaves the same
 * and a re-render loop can't fire a hundred identical reports.
 */
export function useReportError(error: Error & { digest?: string }, scope = "boundary") {
  useEffect(() => {
    let cancelled = false;
    const send = async () => {
      try {
        await fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            scope,
            message: error.message || "Unknown error",
            stack: error.stack ?? null,
            url: typeof window === "undefined" ? null : window.location.pathname,
            digest: error.digest ?? null,
          }),
        });
      } catch {
        // Nothing useful to do — the user already sees an error screen.
      }
    };
    if (!cancelled) void send();
    return () => {
      cancelled = true;
    };
  }, [error, scope]);
}
