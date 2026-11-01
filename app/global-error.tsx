"use client";

import { useReportError } from "@/components/error-reporter";

/**
 * Last-resort boundary: replaces the root layout, so it must ship its own
 * <html> and cannot rely on app styles or provider context.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error, "global");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f7f6f2",
          color: "#16150f",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Something went sideways</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#54524a", margin: "0 0 20px" }}>
            That&apos;s on us, not on you. This has been logged — nothing you submitted was lost.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "11px 20px",
                background: "#1f6f4a",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: 999,
                padding: "11px 20px",
                border: "1px solid #d8d4c8",
                color: "#16150f",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
