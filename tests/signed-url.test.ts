import { beforeAll, describe, expect, it } from "vitest";

/**
 * The signed playback link is the only thing standing between a private lesson
 * and anyone who guesses a request id. Five attack shapes are covered here.
 */

let signAccess: typeof import("@/lib/signed-url").signAccess;
let verifyAccess: typeof import("@/lib/signed-url").verifyAccess;

beforeAll(async () => {
  process.env.STREAM_SIGNING_SECRET = "test-secret-for-unit-tests-only";
  const mod = await import("@/lib/signed-url");
  signAccess = mod.signAccess;
  verifyAccess = mod.verifyAccess;
});

function parse(url: string) {
  const query = new URL(url, "http://localhost").searchParams;
  return { exp: query.get("exp") ?? undefined, sig: query.get("sig") ?? undefined };
}

describe("signed playback links", () => {
  it("accepts a link it just issued", () => {
    const { url } = signAccess("req_1", "usr_1");
    const { exp, sig } = parse(url);
    expect(verifyAccess("req_1", "usr_1", exp, sig)).toEqual({ ok: true });
  });

  it("defaults to a 15-minute lifetime", () => {
    const { expiresAt, ttlSeconds } = signAccess("req_1", "usr_1");
    expect(ttlSeconds).toBe(900);
    expect(Math.abs(expiresAt - (Math.floor(Date.now() / 1000) + 900))).toBeLessThan(5);
  });

  it("refuses a link with nothing attached", () => {
    expect(verifyAccess("req_1", "usr_1", undefined, undefined)).toEqual({ ok: false, reason: "missing" });
    expect(verifyAccess("req_1", "usr_1", "123", undefined)).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses another user's signature", () => {
    const { url } = signAccess("req_1", "usr_1");
    const { exp, sig } = parse(url);
    // Same request, different viewer: the signature must not transfer.
    expect(verifyAccess("req_1", "usr_2", exp, sig)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a swapped request id", () => {
    const { url } = signAccess("req_1", "usr_1");
    const { exp, sig } = parse(url);
    expect(verifyAccess("req_2", "usr_1", exp, sig)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an extended expiry, because it is inside the signed payload", () => {
    const { url } = signAccess("req_1", "usr_1");
    const { exp, sig } = parse(url);
    const stretched = String(Number(exp) + 86_400);
    expect(verifyAccess("req_1", "usr_1", stretched, sig)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an expired link even when the signature is genuine", () => {
    const { url } = signAccess("req_1", "usr_1", -60); // already expired
    const { exp, sig } = parse(url);
    expect(verifyAccess("req_1", "usr_1", exp, sig)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a tampered signature of the right length", () => {
    const { url } = signAccess("req_1", "usr_1");
    const { exp, sig } = parse(url);
    const flipped = sig!.slice(0, -2) + (sig!.endsWith("AA") ? "BB" : "AA");
    expect(verifyAccess("req_1", "usr_1", exp, flipped)).toEqual({ ok: false, reason: "invalid" });
  });
});
