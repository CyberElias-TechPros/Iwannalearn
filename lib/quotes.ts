import { getDb, row, rows, randomUUID } from "./db";
import { PRICING, formatNaira, taxPortion, type PaidTier } from "./pricing";
import { notifyUser, queueEmail } from "./notify";
import { track } from "./service";

/**
 * Quotes: the missing step between "I need this" and "here's my money".
 *
 * The published promise is that scope and price are agreed *before* anyone is
 * charged. A fixed catalogue price can't honour that for bespoke work, so every
 * paid request carries a quote the learner must accept. Payment is then gated on
 * that acceptance — see `paymentGate`, which `createCheckout` calls.
 *
 * Rules that make the flow trustworthy:
 *  - the creator proposes, only the learner accepts (no self-approval),
 *  - price can never fall below the published floor for the tier,
 *  - a declined quote frees the request to be re-quoted, never silently re-priced,
 *  - accepting stores the exact amount that will later be charged, so a price
 *    change after acceptance is impossible without a new quote.
 */

export type QuoteStatus = "proposed" | "accepted" | "declined" | "withdrawn";

export type Quote = {
  id: string;
  request_id: string;
  amount_kobo: number;
  currency: string;
  scope: string;
  deliverables: string | null;
  turnaround_days: number | null;
  revisions: number;
  status: QuoteStatus;
  proposed_by: string;
  proposed_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  decline_note: string | null;
};

export function getQuote(requestId: string): Quote | null {
  return row<Quote>(getDb().prepare("SELECT * FROM quotes WHERE request_id = ?"), requestId);
}

export function listQuotes(status?: QuoteStatus): Quote[] {
  const db = getDb();
  return status
    ? rows<Quote>(db.prepare("SELECT * FROM quotes WHERE status = ? ORDER BY proposed_at DESC"), status)
    : rows<Quote>(db.prepare("SELECT * FROM quotes ORDER BY proposed_at DESC"));
}

/** The published floor: private starts at ₦25,000, priority is a fixed ₦4,000. */
export function minimumFor(tier: PaidTier): number {
  return PRICING[tier].amountKobo;
}

export function priceProblem(tier: PaidTier, amountKobo: number): string | null {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return "Enter a price greater than zero.";
  if (!Number.isInteger(amountKobo)) return "Prices are whole kobo — no decimals.";
  if (amountKobo % 100 !== 0) return "Prices must be a whole naira amount.";
  if (amountKobo < minimumFor(tier)) {
    return `The published price for this tier starts at ${formatNaira(minimumFor(tier))}.`;
  }
  if (tier === "priority" && amountKobo > minimumFor(tier)) {
    return `Priority slots are a fixed ${formatNaira(minimumFor(tier))} — a higher quote would be a private lesson.`;
  }
  return null;
}

/** Sensible starting point shown in the creator's form. */
export function suggestedScope(tier: PaidTier, title: string): { scope: string; deliverables: string; turnaroundDays: number; revisions: number } {
  if (tier === "priority") {
    return {
      scope: `Film “${title}” next, ahead of the free queue, and publish it to the public library.`,
      deliverables: "One published lesson video, plus the notes and files used to make it.",
      turnaroundDays: 5,
      revisions: 1,
    };
  }
  return {
    scope: `A private walkthrough built around your own project and files: “${title}”. Never published.`,
    deliverables: "One private video walkthrough, the working files, and a written summary of the steps.",
    turnaroundDays: 10,
    revisions: 1,
  };
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

export function proposeQuote(input: {
  requestId: string;
  creatorId: string;
  amountKobo: number;
  scope: string;
  deliverables?: string | null;
  turnaroundDays?: number | null;
  revisions?: number;
}): QuoteResult {
  const db = getDb();
  const request = row<{ id: string; ref: string; title: string; tier: string; created_by: string; payment_status: string; owner_email: string; owner_name: string | null }>(
    db.prepare("SELECT r.id, r.ref, r.title, r.tier, r.created_by, r.payment_status, u.email AS owner_email, u.name AS owner_name FROM requests r JOIN users u ON u.id = r.created_by WHERE r.id = ?"),
    input.requestId,
  );
  if (!request) return { ok: false, error: "That request doesn't exist." };
  if (request.tier !== "priority" && request.tier !== "private") {
    return { ok: false, error: "Only paid tiers are quoted — free requests never involve money." };
  }
  if (request.payment_status === "paid") {
    return { ok: false, error: "This request is already paid for; a new quote would change what was bought." };
  }

  const scope = input.scope.trim();
  if (scope.length < 20) return { ok: false, error: "Write at least a sentence of scope — the learner is agreeing to it." };

  const problem = priceProblem(request.tier as PaidTier, input.amountKobo);
  if (problem) return { ok: false, error: problem };

  const existing = getQuote(input.requestId);
  if (existing && existing.status === "accepted") {
    return { ok: false, error: "The learner already accepted a quote. Re-pricing now would be a bait and switch." };
  }

  const now = new Date().toISOString();
  const id = existing?.id ?? randomUUID();

  if (existing) {
    // Re-proposing replaces the offer in place, keeping one live quote per request.
    db.prepare(
      `UPDATE quotes SET amount_kobo = ?, scope = ?, deliverables = ?, turnaround_days = ?, revisions = ?,
        status = 'proposed', proposed_by = ?, proposed_at = ?, accepted_at = NULL, declined_at = NULL, decline_note = NULL
       WHERE request_id = ?`,
    ).run(
      input.amountKobo,
      scope,
      input.deliverables?.trim() || null,
      input.turnaroundDays ?? null,
      Math.max(0, input.revisions ?? 1),
      input.creatorId,
      now,
      input.requestId,
    );
  } else {
    db.prepare(
      `INSERT INTO quotes (id, request_id, amount_kobo, currency, scope, deliverables, turnaround_days, revisions,
        status, proposed_by, proposed_at)
       VALUES (?, ?, ?, 'NGN', ?, ?, ?, ?, 'proposed', ?, ?)`,
    ).run(
      id,
      input.requestId,
      input.amountKobo,
      scope,
      input.deliverables?.trim() || null,
      input.turnaroundDays ?? null,
      Math.max(0, input.revisions ?? 1),
      input.creatorId,
      now,
    );
  }

  db.prepare("UPDATE requests SET price_kobo = ?, updated_at = ? WHERE id = ?").run(
    input.amountKobo,
    now,
    input.requestId,
  );

  const quote = getQuote(input.requestId)!;
  const amount = formatNaira(input.amountKobo);

  notifyUser({
    userId: request.created_by,
    kind: "payment",
    title: `Your quote is ready — ${amount}`,
    body: `Scope agreed for “${request.title}”. Nothing is charged until you accept it.`,
    href: `/requests/${request.id}`,
  });

  queueEmail({
    to: request.owner_email, userId: request.created_by,
    template: "status_update",
    idempotencyKey: `quote:${quote.id}:${quote.proposed_at}`,
    // A price change is exactly the kind of mail a learner must not miss.
    critical: true,
    data: {
      name: request.owner_name ?? "there",
      heading: `Your quote: ${amount}`,
      body: `Scope for “${request.title}” is agreed and priced at ${amount}. Nothing has been charged. Open your request to accept or decline — if you decline, you owe nothing and can tell us why.`,
      href: `/requests/${request.id}`,
    },
  });

  track("quote_proposed", { requestId: input.requestId, data: { amountKobo: input.amountKobo } });
  return { ok: true, quote };
}

export function acceptQuote(input: { requestId: string; userId: string }): QuoteResult {
  const db = getDb();
  const request = row<{ id: string; title: string; created_by: string; payment_status: string }>(
    db.prepare("SELECT id, title, created_by, payment_status FROM requests WHERE id = ?"),
    input.requestId,
  );
  if (!request) return { ok: false, error: "That request doesn't exist." };
  if (request.created_by !== input.userId) return { ok: false, error: "Only the person who asked can accept a quote." };

  const quote = getQuote(input.requestId);
  if (!quote) return { ok: false, error: "There's no quote to accept yet." };
  if (quote.status === "accepted") return { ok: true, quote };
  if (quote.status === "declined") return { ok: false, error: "That quote was declined. Ask for a fresh one." };

  const now = new Date().toISOString();
  db.prepare("UPDATE quotes SET status = 'accepted', accepted_at = ? WHERE request_id = ?").run(now, input.requestId);
  db.prepare("UPDATE requests SET price_kobo = ?, updated_at = ? WHERE id = ?").run(
    quote.amount_kobo,
    now,
    input.requestId,
  );

  const accepted = getQuote(input.requestId)!;
  const amount = formatNaira(quote.amount_kobo);

  notifyUser({
    userId: quote.proposed_by,
    kind: "payment",
    title: `Quote accepted — ${amount}`,
    body: `“${request.title}” is agreed at ${amount}. You can start as soon as they pay.`,
    href: "/admin/quotes",
  });

  track("quote_accepted", { userId: input.userId, requestId: input.requestId, data: { amountKobo: quote.amount_kobo } });
  return { ok: true, quote: accepted };
}

export function declineQuote(input: { requestId: string; userId: string; note?: string }): QuoteResult {
  const db = getDb();
  const request = row<{ id: string; title: string; created_by: string }>(
    db.prepare("SELECT id, title, created_by FROM requests WHERE id = ?"),
    input.requestId,
  );
  if (!request) return { ok: false, error: "That request doesn't exist." };
  if (request.created_by !== input.userId) return { ok: false, error: "Only the person who asked can decline a quote." };

  const quote = getQuote(input.requestId);
  if (!quote) return { ok: false, error: "There's no quote to decline." };
  if (quote.status === "accepted") {
    return { ok: false, error: "You already accepted this quote. Message support if something has changed." };
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE quotes SET status = 'declined', declined_at = ?, decline_note = ? WHERE request_id = ?",
  ).run(now, input.note?.trim().slice(0, 500) || null, input.requestId);

  notifyUser({
    userId: quote.proposed_by,
    kind: "payment",
    title: "Quote declined",
    body: `${request.title} — ${input.note?.trim() || "no reason given"}`,
    href: "/admin/quotes",
  });

  track("quote_declined", { userId: input.userId, requestId: input.requestId });
  return { ok: true, quote: getQuote(input.requestId)! };
}

/**
 * The gate `createCheckout` runs. Returns the exact amount that may be charged,
 * or a human explanation of what has to happen first.
 */
export function paymentGate(requestId: string): { ok: true; amountKobo: number; quote: Quote } | { ok: false; error: string } {
  const quote = getQuote(requestId);
  if (!quote) {
    return {
      ok: false,
      error: "Nothing can be charged yet — a quote is agreed first. It's on its way; you'll get an email.",
    };
  }
  if (quote.status === "declined") {
    return { ok: false, error: "You declined this quote, so there's nothing to pay. Reply to ask for a different scope." };
  }
  if (quote.status === "withdrawn") {
    return { ok: false, error: "That quote was withdrawn. Ask for a fresh one." };
  }
  if (quote.status !== "accepted") {
    return { ok: false, error: "Your quote is waiting for you — accept the scope and price first, then pay." };
  }
  return { ok: true, amountKobo: Number(quote.amount_kobo), quote };
}

/** Price shown on cards: the agreed quote, else the published floor. */
export function displayPrice(requestId: string, tier: PaidTier): { label: string; fromQuote: boolean } {
  const quote = getQuote(requestId);
  if (quote && quote.status !== "declined" && quote.status !== "withdrawn") {
    return { label: formatNaira(Number(quote.amount_kobo)), fromQuote: true };
  }
  return { label: PRICING[tier].label, fromQuote: false };
}

export function quoteBreakdown(amountKobo: number) {
  const taxKobo = taxPortion(amountKobo);
  return { totalKobo: amountKobo, taxKobo, netKobo: amountKobo - taxKobo, taxLabel: formatNaira(taxKobo) };
}
