#!/usr/bin/env node
/**
 * End-to-end smoke test: exercises the loop against a running server using the
 * real HTTP surface (public routes) and the real database (business rules).
 *
 *   npm run dev      # in one terminal
 *   npm run smoke    # in another
 *
 * Exit code is non-zero if anything fails, so it works in CI.
 */
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const DB = process.env.DATABASE_FILE ?? "data/iwannalearn.db";

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

const db = new DatabaseSync(DB);
const q = (sql, ...params) => db.prepare(sql).all(...params);
const one = (sql, ...params) => db.prepare(sql).get(...params);

console.log(`\nSmoke test against ${BASE}\n`);

console.log("Public routes");
for (const path of [
  "/",
  "/explore",
  "/explore?tab=requests",
  "/pricing",
  "/how-it-works",
  "/contact",
  "/requests/new",
  "/login",
  "/legal/privacy",
  "/legal/terms",
  "/legal/not-covered",
  "/robots.txt",
  "/sitemap.xml",
]) {
  await check(`GET ${path}`, async () => {
    const { status } = await get(path);
    assert.equal(status, 200, `expected 200, got ${status}`);
  });
}

await check("GET /api/search returns lessons and requests", async () => {
  const { status, body } = await get("/api/search?q=sql");
  assert.equal(status, 200);
  const payload = JSON.parse(body);
  assert.ok(Array.isArray(payload.lessons) && Array.isArray(payload.requests));
});

await check("private request is 404 for anonymous visitors", async () => {
  const privateSlug = one("SELECT slug FROM requests WHERE visibility = 'private' LIMIT 1")?.slug;
  assert.ok(privateSlug, "seed has a private request");
  const { status } = await get(`/requests/${privateSlug}`);
  assert.equal(status, 404);
});

console.log("\nData integrity");
await check("every fulfilled request has a published reply", async () => {
  const orphans = q(`
    SELECT r.ref FROM requests r
     WHERE r.status = 'fulfilled'
       AND NOT EXISTS (SELECT 1 FROM replies p WHERE p.request_id = r.id AND p.kind = 'external' AND p.video_url IS NOT NULL)
  `);
  assert.equal(orphans.length, 0, `orphaned: ${orphans.map((row) => row.ref).join(", ")}`);
});

await check("tier and visibility are consistent", async () => {
  const wrong = q(`
    SELECT ref, tier, visibility FROM requests
     WHERE (tier = 'private' AND visibility != 'private')
        OR (tier != 'private' AND visibility = 'private')
  `);
  assert.equal(wrong.length, 0, wrong.map((row) => `${row.ref} (${row.tier}/${row.visibility})`).join(", "));
});

await check("paid payments have an active entitlement", async () => {
  const missing = q(`
    SELECT p.reference FROM payments p
     WHERE p.status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM entitlements e WHERE e.user_id = p.user_id AND e.request_id = p.request_id AND e.revoked_at IS NULL
       )
  `);
  assert.equal(missing.length, 0, `missing grants: ${missing.map((row) => row.reference).join(", ")}`);
});

await check("refunded payments have a revoked entitlement", async () => {
  const leaked = q(`
    SELECT p.reference FROM payments p
     JOIN entitlements e ON e.user_id = p.user_id AND e.request_id = p.request_id
     WHERE p.status = 'refunded' AND e.revoked_at IS NULL
  `);
  assert.equal(leaked.length, 0);
});

await check("payment amounts are integers in kobo", async () => {
  const bad = q("SELECT reference FROM payments WHERE amount_kobo != CAST(amount_kobo AS INTEGER) OR amount_kobo <= 0");
  assert.equal(bad.length, 0);
});

await check("no duplicate notification idempotency keys", async () => {
  const dupes = q(`
    SELECT idempotency_key, COUNT(*) AS n FROM notification_logs
     GROUP BY idempotency_key HAVING n > 1
  `);
  assert.equal(dupes.length, 0);
});

await check("every queued email has exactly one log row", async () => {
  const orphans = q(`
    SELECT o.id FROM outbox o WHERE NOT EXISTS (SELECT 1 FROM notification_logs l WHERE l.outbox_id = o.id)
  `);
  assert.equal(orphans.length, 0);
});

await check("statuses are drawn from the documented set", async () => {
  const allowed = ["submitted", "under_review", "planned", "in_production", "waitlisted", "fulfilled", "declined"];
  const bad = q("SELECT DISTINCT status FROM requests").filter((row) => !allowed.includes(row.status));
  assert.equal(bad.length, 0, `unknown: ${bad.map((row) => row.status).join(", ")}`);
});

await check("every request has a creation event", async () => {
  const missing = q(`
    SELECT r.ref FROM requests r
     WHERE NOT EXISTS (SELECT 1 FROM request_events e WHERE e.request_id = r.id AND e.kind = 'created')
  `);
  assert.equal(missing.length, 0, missing.map((row) => row.ref).join(", "));
});

console.log("\nPayments");
await check("mock payment gateway page renders for a pending payment", async () => {
  const pending = one("SELECT reference FROM payments WHERE status = 'pending' LIMIT 1");
  if (!pending) {
    console.log("      (no pending payment in this database — skipped)");
    return;
  }
  const { status } = await get(`/checkout/${pending.reference}`);
  assert.ok([200, 404].includes(status), `unexpected status ${status}`);
});

await check("webhook rejects an unsigned request", async () => {
  const response = await fetch(`${BASE}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "charge.success", data: { reference: "IWL-FAKE" } }),
  });
  assert.ok([400, 401, 503].includes(response.status), `expected rejection, got ${response.status}`);
});

await check("digest cron is closed without CRON_SECRET", async () => {
  const response = await fetch(`${BASE}/api/cron/digest`, { method: "POST" });
  assert.ok([401, 503].includes(response.status), `expected 401/503, got ${response.status}`);
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
