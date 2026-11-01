import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The CSP is deliberately **not** nonce-based: nonces force every page to be
 * dynamic and break the preview proxy's caching, and this app's main injection
 * surface is user-authored text, which React escapes. What the policy does do is
 * remove the dangerous capabilities — no plugins, no injected `<base>`, no
 * framing of third-party documents, no cross-origin form posts — while allowing
 * the one embed the product needs (YouTube's privacy-enhanced player).
 *
 * `frame-ancestors` is intentionally absent: the app is served inside the
 * preview proxy's iframe and arena.ai/e2b.app origins cannot be enumerated.
 */
const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap/flight scripts; 'unsafe-eval' is only needed in dev.
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Privacy-enhanced YouTube playback only.
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Ignored over plain HTTP, correct once TLS terminates in front of the app.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The preview proxy serves the app from an e2b.app host; allow dev requests from it.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded files are served with their own sandboxing headers, but make
      // sure a stray direct hit can never be sniffed into something executable.
      { source: "/api/uploads/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};

export default nextConfig;
