import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "iwl-mobile-"));
process.env.DATABASE_FILE = path.join(dir, "mobile.db");
process.env.DEMO_MODE = "true";
process.env.PAYMENTS_MODE = "mock";
process.env.SITE_URL = "https://learn.example.com";
process.env.STREAM_ALLOWED_HOSTS = "media.example.com";
process.env.STREAM_SIGNING_SECRET = "test-secret-with-at-least-thirty-two-characters";

let api: typeof import("@/lib/mobile-api");
let auth: typeof import("@/lib/auth");
let db: ReturnType<typeof import("@/lib/db").getDb>;
let learnerToken: string;
let creatorToken: string;
let otherToken: string;
let privateOwnerToken: string;
let privateId: string;
let privateSlug: string;

async function call(method: string, route: string, body?: unknown, token?: string) {
  const request = new Request(`https://learn.example.com/api/mobile/v1/${route}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await api.handleMobileApi(request, route.split("?")[0].split("/"));
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, response };
}

beforeAll(async () => {
  api = await import("@/lib/mobile-api");
  auth = await import("@/lib/auth");
  db = (await import("@/lib/db")).getDb();
  learnerToken = auth.createSession("usr_amara", "android").token;
  creatorToken = auth.createSession("usr_creator", "android").token;
  otherToken = auth.createSession("usr_tunde", "android").token;
  privateOwnerToken = auth.createSession("usr_ife", "android").token;
});
afterAll(() => vi.unstubAllGlobals());

describe("native API authentication and privacy", () => {
  it("bootstraps without exposing accounts or server settings", async () => {
    const result = await call("GET", "bootstrap");
    expect(result.status).toBe(200);
    expect(result.body.apiVersion).toBe(1);
    expect(result.body.categories.length).toBeGreaterThan(0);
    expect(result.body).not.toHaveProperty("users");
    expect(result.body).not.toHaveProperty("STREAM_SIGNING_SECRET");
  });
  it("requires explicit bearer auth, not an ambient web cookie", async () => {
    expect((await call("GET", "me")).status).toBe(401);
    const response = await api.handleMobileApi(new Request("https://learn.example.com/api/mobile/v1/me", { headers: { Cookie: `iwl_session=${learnerToken}` } }), ["me"]);
    expect(response.status).toBe(401);
    expect((await call("GET", "me", undefined, learnerToken)).body.user.email).toBe("amara@example.com");
  });
  it("never returns a magic token when demo mode is off", async () => {
    process.env.DEMO_MODE = "false";
    const result = await call("POST", "auth/login", { email: "mobile-test@example.com", name: "Mobile Tester" });
    expect(result.status).toBe(200);
    expect(result.body.demoToken).toBeUndefined();
    const email = db.prepare("SELECT body FROM outbox WHERE to_email = ? ORDER BY created_at DESC LIMIT 1").get("mobile-test@example.com") as { body: string };
    const token = email.body.match(/auth\/android\?token=([a-f0-9]{32})/)?.[1];
    expect(token).toBeTruthy();
    const exchanged = await call("POST", "auth/exchange", { token });
    expect(exchanged.status).toBe(200);
    expect(exchanged.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect((await call("POST", "auth/exchange", { token })).status).toBe(401);
    expect((await call("POST", "auth/demo", { role: "creator" })).status).toBe(404);
    process.env.DEMO_MODE = "true";
  });
  it("hides private requests from anonymous and unrelated accounts", async () => {
    const slug = "set-up-my-companys-onboarding-sheet-with-our-real-data";
    expect((await call("GET", `requests/${slug}`)).status).toBe(404);
    expect((await call("GET", `requests/${slug}`, undefined, otherToken)).status).toBe(404);
    expect((await call("GET", `requests/${slug}`, undefined, privateOwnerToken)).status).toBe(200);
  });
  it("does not leak owner emails or internal notes in public DTOs", async () => {
    const result = await call("GET", "requests/understand-what-a-neural-network-actually-is", undefined, otherToken);
    expect(result.status).toBe(200);
    expect(result.body.request).not.toHaveProperty("ownerEmail");
    expect(result.body.request).not.toHaveProperty("moderationNote");
    expect(result.body.internalNotes).toEqual([]);
    expect(result.body.attachments).toEqual([]);
    expect(result.body.quote).toBeNull();
    expect(result.body.events.every((e: any) => !("message" in e))).toBe(true);
  });
  it("enforces creator role on every admin surface", async () => {
    expect((await call("GET", "admin", undefined, learnerToken)).status).toBe(403);
    expect((await call("POST", "admin/settings", {}, learnerToken)).status).toBe(403);
    expect((await call("GET", "admin", undefined, creatorToken)).status).toBe(200);
  });
  it("revokes a native session on logout", async () => {
    const token = auth.createSession("usr_zara", "android").token;
    expect((await call("POST", "auth/logout", {}, token)).status).toBe(200);
    expect((await call("GET", "me", undefined, token)).status).toBe(401);
  });
});

describe("native intake and money path", () => {
  it("makes request retries idempotent and forces private visibility server-side", async () => {
    const input = { title: "Build a private onboarding checklist for my team", goal: "Walk through my actual onboarding sheet and show the formulas without exposing our data.", category: "Spreadsheets", level: "some", tier: "private", visibility: "public", priceKobo: 1, clientRequestId: "11111111-1111-4111-8111-111111111111" };
    const first = await call("POST", "requests", input, learnerToken);
    const retry = await call("POST", "requests", input, learnerToken);
    expect(first.status).toBe(201);
    expect(retry.body.request.id).toBe(first.body.request.id);
    privateId = first.body.request.id; privateSlug = first.body.request.slug;
    const detail = await call("GET", `requests/${privateSlug}`, undefined, learnerToken);
    expect(detail.body.request.visibility).toBe("private");
    expect(detail.body.request.priceKobo).toBeNull();
    expect(detail.body.request.paymentStatus).toBe("none");
  });
  it("rejects someone else's staged upload", async () => {
    db.prepare("INSERT INTO uploads (id, user_id, filename, mime, size, storage_key, created_at) VALUES ('upload-other', 'usr_tunde', 'a.pdf', 'application/pdf', 10, 'private-key', ?)").run(new Date().toISOString());
    const result = await call("POST", "requests", { title: "A sufficiently specific request title", goal: "A sufficiently detailed goal that explains what I want to learn.", category: "Other", level: "new", tier: "community", uploadIds: ["upload-other"] }, learnerToken);
    expect(result.status).toBe(422);
  });
  it("requires an accepted quote, then settles only the owner's test payment", async () => {
    expect((await call("POST", `requests/${privateId}/checkout`, {}, learnerToken)).status).toBe(422);
    const quote = await call("POST", `admin/requests/${privateId}/quote`, { amountKobo: 2_500_000, scope: "A private walkthrough of your onboarding sheet and its formulas.", deliverables: "One private video and working sheet.", turnaroundDays: 10, revisions: 1 }, creatorToken);
    expect(quote.status).toBe(200);
    expect((await call("POST", `requests/${privateId}/checkout`, {}, learnerToken)).status).toBe(422);
    expect((await call("POST", `requests/${privateId}/quote`, { accept: true }, creatorToken)).status).toBe(403);
    expect((await call("POST", `requests/${privateId}/quote`, { accept: true }, learnerToken)).status).toBe(200);
    const checkout = await call("POST", `requests/${privateId}/checkout`, {}, learnerToken);
    expect(checkout.status).toBe(200);
    expect(checkout.body.amountKobo).toBe(2_500_000);
    expect(checkout.body.mode).toBe("mock");
    expect(checkout.body.url).toBeNull();
    const reference = checkout.body.reference;
    expect((await call("POST", `requests/${privateId}/confirm-test-payment`, { reference }, otherToken)).status).toBe(404);
    expect((await call("POST", `requests/${privateId}/confirm-test-payment`, { reference }, learnerToken)).status).toBe(200);
    const detail = await call("GET", `requests/${privateSlug}`, undefined, learnerToken);
    expect(detail.body.request.paymentStatus).toBe("paid");
  });
  it("will not settle a test payment after live mode is enabled", async () => {
    const created = await call("POST", "requests", { title: "Schedule a lesson about reusable spreadsheet formulas", goal: "Teach me to build a reusable formula table for a small reporting sheet.", category: "Spreadsheets", level: "new", tier: "priority" }, learnerToken);
    const id = created.body.request.id;
    await call("POST", `admin/requests/${id}/quote`, { amountKobo: 400_000, scope: "Film this spreadsheet lesson next and publish it to the public library.", revisions: 1 }, creatorToken);
    await call("POST", `requests/${id}/quote`, { accept: true }, learnerToken);
    const checkout = await call("POST", `requests/${id}/checkout`, {}, learnerToken);
    expect(checkout.status).toBe(200);
    process.env.PAYMENTS_MODE = "live";
    expect((await call("POST", `requests/${id}/confirm-test-payment`, { reference: checkout.body.reference }, learnerToken)).status).toBe(403);
    expect((await call("POST", `requests/${id}/checkout`, {}, learnerToken)).status).toBe(503);
    process.env.PAYMENTS_MODE = "mock";
  });
});

describe("protected native playback", () => {
  it("rejects unapproved upstream hosts and private YouTube delivery", async () => {
    const payload = { message: "Start with the first tab and follow the formula through.", videoTitle: "Your private onboarding walkthrough" };
    expect((await call("POST", `admin/requests/${privateId}/publish`, { ...payload, streamUrl: "https://169.254.169.254/latest/meta-data" }, creatorToken)).status).toBe(422);
    expect((await call("POST", `admin/requests/${privateId}/publish`, { ...payload, videoUrl: "https://youtu.be/dQw4w9WgXcQ" }, creatorToken)).status).toBe(422);
  });
  it("returns an account-bound API URL, never the upstream source", async () => {
    const result = await call("POST", `admin/requests/${privateId}/publish`, { message: "Start with the first tab and follow the formula through.", videoTitle: "Your private onboarding walkthrough", streamUrl: "https://media.example.com/private/lesson.m3u8" }, creatorToken);
    expect(result.status).toBe(200);
    const access = await call("GET", `requests/${privateId}/playback`, undefined, learnerToken);
    expect(access.status).toBe(200);
    expect(access.body.kind).toBe("direct");
    expect(access.body.url).toContain("learn.example.com/api/mobile/v1/requests/");
    expect(access.body.url).not.toContain("media.example.com");
    expect((await call("GET", `requests/${privateId}/playback`, undefined, otherToken)).status).toBe(404);
    const url = new URL(access.body.url);
    const route = `${privateId}/stream${url.search}`;
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("video-bytes", { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-10/100" } }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = await api.handleMobileApi(new Request(access.body.url, { headers: { Authorization: `Bearer ${learnerToken}`, Range: "bytes=0-10" } }), [privateId, "stream"]);
    expect(stream.status).toBe(206);
    expect(stream.headers.get("cache-control")).toContain("no-store");
    const upstreamHeaders = fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(upstreamHeaders.headers.Range).toBe("bytes=0-10");
    expect(upstreamHeaders.headers.Authorization).toBeUndefined();
    vi.unstubAllGlobals();
    expect((await call("GET", `${privateId}/stream?exp=1&sig=bad`, undefined, learnerToken)).status).toBe(401);
  });
  it("revokes playback after a refund", async () => {
    const detail = await call("GET", `requests/${privateSlug}`, undefined, learnerToken);
    const reference = detail.body.payment.reference;
    expect((await call("POST", `admin/payments/${reference}/refund`, { reason: "Testing access revocation" }, creatorToken)).status).toBe(200);
    expect((await call("GET", `requests/${privateId}/playback`, undefined, learnerToken)).status).toBe(403);
  });
});
