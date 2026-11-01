import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring access to private lessons.
 *
 * An unlisted URL is not private, so private delivery is gated by a token that
 * names the request, the viewer and an expiry, and is signed with a server-only
 * secret. The same shape a CDN expects: swap `verify` for an Mux / Cloudflare
 * Stream playback-token check and nothing else changes.
 */

const DEFAULT_TTL_SECONDS = 15 * 60;

function secret(): string {
  return process.env.STREAM_SIGNING_SECRET ?? "dev-only-secret-change-me";
}

function payload(requestId: string, userId: string, expiresAt: number): string {
  return `${requestId}.${userId}.${expiresAt}`;
}

export function signAccess(requestId: string, userId: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHmac("sha256", secret()).update(payload(requestId, userId, expiresAt)).digest("base64url");
  return {
    url: `/watch/${requestId}?exp=${expiresAt}&sig=${signature}`,
    expiresAt,
    ttlSeconds,
  };
}

export function verifyAccess(
  requestId: string,
  userId: string,
  exp: string | undefined,
  sig: string | undefined,
): { ok: true } | { ok: false; reason: "missing" | "expired" | "invalid" } {
  if (!exp || !sig) return { ok: false, reason: "missing" };
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: "invalid" };
  if (expiresAt * 1000 < Date.now()) return { ok: false, reason: "expired" };

  const expected = createHmac("sha256", secret()).update(payload(requestId, userId, expiresAt)).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  return { ok: true };
}
