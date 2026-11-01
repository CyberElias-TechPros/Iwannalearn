import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The promise the product makes is: nobody is charged for scope they haven't
 * accepted. That promise lives in `paymentGate`, so it is tested against a real
 * (throwaway) database rather than a mock — including the tamper cases.
 */

const dir = mkdtempSync(path.join(tmpdir(), "iwl-test-"));
process.env.DATABASE_FILE = path.join(dir, "test.db");

let quotes: typeof import("@/lib/quotes");
let db: ReturnType<typeof import("@/lib/db").getDb>;

const REQUEST = "req_test_quote";
const OTHER = "req_test_quote_2";
const LEARNER = "usr_test_learner";
const CREATOR = "usr_test_creator";

beforeAll(async () => {
  quotes = await import("@/lib/quotes");
  const mod = await import("@/lib/db");
  db = mod.getDb();

  const now = new Date().toISOString();
  for (const id of [LEARNER, CREATOR]) {
    db.prepare("INSERT INTO users (id, email, name, role, created_at) VALUES (?, ?, ?, ?, ?)").run(
      id,
      `${id}@example.test`,
      id,
      id === CREATOR ? "creator" : "learner",
      now,
    );
  }
  for (const [id, tier] of [
    [REQUEST, "private"],
    [OTHER, "priority"],
  ] as const) {
    db.prepare(
      "INSERT INTO requests (id, ref, slug, title, goal, category, level, tier, visibility, status, created_by, created_at, updated_at, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none')",
    ).run(
      id,
      id.replace("req_test_", "REQ-T").toUpperCase(),
      id,
      `Test request ${id}`,
      "A goal long enough to be valid for the schema.",
      "Spreadsheets",
      "new",
      tier,
      "private",
      "submitted",
      LEARNER,
      now,
      now,
    );
  }
});

describe("paymentGate — nothing to pay without an agreed quote", () => {
  it("refuses payment when no quote exists", () => {
    const gate = quotes.paymentGate(REQUEST);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.error).toMatch(/quote/i);
  });

  it("refuses payment while the quote is only proposed", () => {
    const proposed = quotes.proposeQuote({
      requestId: REQUEST,
      creatorId: CREATOR,
      amountKobo: 3_500_000,
      scope: "A private walkthrough of the onboarding sheet, with the template tab rebuilt.",
    });
    expect(proposed.ok).toBe(true);

    const gate = quotes.paymentGate(REQUEST);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.error).toMatch(/accept/i);
  });

  it("allows payment after acceptance, for exactly the agreed amount", () => {
    quotes.acceptQuote({ requestId: REQUEST, userId: LEARNER });
    const gate = quotes.paymentGate(REQUEST);
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(gate.amountKobo).toBe(3_500_000);
  });

  it("refuses payment after the learner declines", () => {
    quotes.proposeQuote({
      requestId: OTHER,
      creatorId: CREATOR,
      amountKobo: 400_000,
      scope: "Film this next, ahead of the free queue, and publish it publicly.",
    });
    quotes.declineQuote({ requestId: OTHER, userId: LEARNER, note: "Too expensive right now." });

    const gate = quotes.paymentGate(OTHER);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.error).toMatch(/declined/i);
  });
});

describe("quote rules", () => {
  it("will not quote below the published floor", () => {
    const problem = quotes.priceProblem("private", 1_000_000); // ₦10,000
    expect(problem).toMatch(/starts at/i);
  });

  it("keeps priority at a fixed price", () => {
    expect(quotes.priceProblem("priority", 400_000)).toBeNull();
    expect(quotes.priceProblem("priority", 900_000)).toMatch(/fixed/i);
  });

  it("rejects fractional naira", () => {
    expect(quotes.priceProblem("private", 2_500_050)).toMatch(/whole naira/i);
  });

  it("refuses to re-price a quote the learner already accepted", () => {
    const result = quotes.proposeQuote({
      requestId: REQUEST,
      creatorId: CREATOR,
      amountKobo: 5_000_000,
      scope: "A completely different scope, priced up after acceptance.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/accepted/i);
  });

  it("only the person who asked can accept or decline", () => {
    const accepted = quotes.acceptQuote({ requestId: OTHER, userId: CREATOR });
    expect(accepted.ok).toBe(false);
    const declined = quotes.declineQuote({ requestId: REQUEST, userId: CREATOR });
    expect(declined.ok).toBe(false);
  });

  it("refuses free tiers, which never involve money", () => {
    db.prepare("INSERT INTO requests (id, ref, slug, title, goal, category, level, tier, visibility, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'community', 'public', 'submitted', ?, ?, ?)").run(
      "req_test_free",
      "REQ-TFREE",
      "free-request",
      "A free request",
      "A goal long enough to be valid for the schema.",
      "Spreadsheets",
      "new",
      LEARNER,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const result = quotes.proposeQuote({
      requestId: "req_test_free",
      creatorId: CREATOR,
      amountKobo: 400_000,
      scope: "This should never be allowed because the tier is free.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/free/i);
  });
});
