import { getDb, row, rows, randomUUID } from "./db";
import { PRICING, formatNaira, newReference, paymentsEnabled, taxPortion, type PaidTier } from "./pricing";
import { notifyUser, queueEmail } from "./notify";
import { createProviderCheckout } from "./providers";
import { getSetting } from "./service";
import { paymentGate } from "./quotes";

/**
 * Payments & entitlements.
 *
 * The provider is abstracted behind `createCheckout` and `settle`. Today the
 * provider is `mock`: a checkout page that settles on the server with a signed
 * reference, which exercises the *whole* real path — pending → paid →
 * entitlement → receipt → notification, and refund → revoked access.
 *
 * Stripe (international cards) and Paystack (NGN, local cards and transfers)
 * replace `createCheckout` and post to the same `settle()` from a webhook.
 * Settlement is idempotent by reference, so a replayed webhook cannot
 * double-grant or double-email.
 */

export type CheckoutResult =
  | { ok: true; reference: string; amountKobo: number; taxKobo: number; label: string }
  | { ok: false; error: string };

export function createCheckout(userId: string, requestId: string, kind: PaidTier): CheckoutResult {
  if (!paymentsEnabled()) return { ok: false, error: "Payments aren't switched on yet." };

  const db = getDb();
  const request = row<{ id: string; ref: string; created_by: string; tier: string; payment_status: string }>(
    db.prepare("SELECT id, ref, created_by, tier, payment_status FROM requests WHERE id = ?"),
    requestId,
  );

  if (!request) return { ok: false, error: "That request doesn't exist." };
  if (request.created_by !== userId) return { ok: false, error: "You can only pay for your own request." };
  if (request.payment_status === "paid") return { ok: false, error: "This one is already paid for." };
  if (request.tier !== kind) {
    return { ok: false, error: `This request is on the ${request.tier} tier, not ${kind}.` };
  }

  // Scope and price must be agreed before money moves. This is the single gate
  // that makes that promise true — the checkout UI merely reflects it.
  const gate = paymentGate(requestId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const existing = row<{ reference: string; amount_kobo: number; tax_kobo: number; status: string }>(
    db.prepare(
      "SELECT reference, amount_kobo, tax_kobo, status FROM payments WHERE request_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    ),
    requestId,
  );
  if (existing) {
    return {
      ok: true,
      reference: existing.reference,
      amountKobo: Number(existing.amount_kobo),
      taxKobo: Number(existing.tax_kobo),
      label: PRICING[kind].label,
    };
  }

  const amountKobo = gate.amountKobo;
  const taxKobo = taxPortion(amountKobo);
  const reference = newReference(request.ref);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO payments (id, request_id, user_id, provider, reference, kind, amount_kobo, tax_kobo, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, 'mock', ?, ?, ?, ?, 'NGN', 'pending', ?, ?)
  `).run(randomUUID(), requestId, userId, reference, kind, amountKobo, taxKobo, now, now);

  db.prepare("UPDATE requests SET price_kobo = ?, payment_status = 'pending', updated_at = ? WHERE id = ?").run(
    amountKobo,
    now,
    requestId,
  );

  return { ok: true, reference, amountKobo, taxKobo, label: PRICING[kind].label };
}

/**
 * Creates (or reuses) a pending payment, then asks the active provider for a
 * hosted checkout URL. In mock mode that URL is the internal checkout page, so
 * the client code path is identical in every mode.
 */
export async function prepareCheckout(
  user: { id: string; email: string },
  requestId: string,
  kind: PaidTier,
  siteUrl: string,
): Promise<{ ok: true; reference: string; url: string } | { ok: false; error: string }> {
  const created = createCheckout(user.id, requestId, kind);
  if (!created.ok) return created;

  const session = await createProviderCheckout({
    reference: created.reference,
    amountKobo: created.amountKobo,
    email: user.email,
    title: `${kind === "private" ? "Private lesson" : "Priority slot"} — ${created.label}`,
    callbackUrl: `${siteUrl}/requests`,
  });

  return { ok: true, reference: created.reference, url: session.url };
}

export function getPayment(reference: string) {
  return row<any>(getDb().prepare("SELECT * FROM payments WHERE reference = ?"), reference);
}

/**
 * Settle a payment. Idempotent: the second call is a no-op that says so.
 * Called by the mock checkout confirmation and (in production) by a webhook.
 */
export function settle(
  reference: string,
  options: { provider?: string; signal?: string } = {},
): { ok: boolean; alreadySettled?: boolean; error?: string; requestId?: string; slug?: string } {
  const db = getDb();
  const payment = getPayment(reference);
  if (!payment) return { ok: false, error: "Unknown payment reference." };
  if (payment.status === "paid") return { ok: true, alreadySettled: true, requestId: payment.request_id };
  if (payment.status === "refunded") return { ok: false, error: "This payment was refunded." };

  // Defence in depth: even a replayed or forged webhook cannot settle an amount
  // the learner never agreed to.
  const gate = paymentGate(payment.request_id);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (Number(payment.amount_kobo) !== gate.amountKobo) {
    return { ok: false, error: "Payment amount doesn't match the accepted quote." };
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ?, provider = ?, updated_at = ? WHERE reference = ?").run(
    now,
    options.provider ?? payment.provider,
    now,
    reference,
  );

  db.prepare(`
    INSERT INTO entitlements (id, user_id, request_id, access_type, granted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, request_id) DO UPDATE SET revoked_at = NULL, granted_at = excluded.granted_at
  `).run(randomUUID(), payment.user_id, payment.request_id, payment.kind === "private" ? "private" : "priority", now);

  db.prepare("UPDATE requests SET payment_status = 'paid', updated_at = ? WHERE id = ?").run(now, payment.request_id);

  const request = row<{ slug: string; title: string; created_by: string }>(
    db.prepare("SELECT slug, title, created_by FROM requests WHERE id = ?"),
    payment.request_id,
  );
  const user = row<{ email: string; name: string | null }>(
    db.prepare("SELECT email, name FROM users WHERE id = ?"),
    payment.user_id,
  );

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'payment', ?, ?, ?)",
  ).run(randomUUID(), payment.request_id, `Payment received (${reference}).`, payment.user_id, now);

  if (user && request) {
    notifyUser({
      userId: payment.user_id,
      kind: "payment_received",
      requestId: payment.request_id,
      title: "Payment received ✅",
      body: `${formatNaira(payment.amount_kobo)} paid for “${request.title}”. Your slot is confirmed.`,
      href: `/requests/${request.slug}`,
    });

    queueEmail({
      to: user.email,
      userId: payment.user_id,
      requestId: payment.request_id,
      template: "receipt",
      idempotencyKey: `receipt:${reference}`,
      critical: true,
      data: {
        name: user.name ?? "there",
        title: request.title,
        amount: formatNaira(payment.amount_kobo),
        tax: formatNaira(payment.tax_kobo),
        reference,
        path: `/requests/${request.slug}`,
        windowDays: getSetting("refund_window_days", "7"),
      },
    });
  }

  return { ok: true, requestId: payment.request_id, slug: request?.slug };
}

export function refund(
  reference: string,
  reason = "Refunded by the creator",
): { ok: boolean; error?: string; requestId?: string } {
  const db = getDb();
  const payment = getPayment(reference);
  if (!payment) return { ok: false, error: "Unknown payment reference." };
  if (payment.status !== "paid") return { ok: false, error: "Only a settled payment can be refunded." };

  const now = new Date().toISOString();
  db.prepare("UPDATE payments SET status = 'refunded', refunded_at = ?, updated_at = ? WHERE reference = ?").run(
    now,
    now,
    reference,
  );
  db.prepare("UPDATE entitlements SET revoked_at = ? WHERE user_id = ? AND request_id = ?").run(
    now,
    payment.user_id,
    payment.request_id,
  );
  db.prepare("UPDATE requests SET payment_status = 'refunded', updated_at = ? WHERE id = ?").run(now, payment.request_id);

  db.prepare(
    "INSERT INTO request_events (id, request_id, kind, message, actor, created_at) VALUES (?, ?, 'refund', ?, 'system', ?)",
  ).run(randomUUID(), payment.request_id, `Refunded ${formatNaira(payment.amount_kobo)} — ${reason}.`, now);

  const request = row<{ slug: string; title: string; created_by: string }>(
    db.prepare("SELECT slug, title, created_by FROM requests WHERE id = ?"),
    payment.request_id,
  );
  const user = row<{ email: string; name: string | null }>(
    db.prepare("SELECT email, name FROM users WHERE id = ?"),
    payment.user_id,
  );

  if (user && request) {
    notifyUser({
      userId: payment.user_id,
      kind: "refund_issued",
      requestId: payment.request_id,
      title: "Refund issued",
      body: `${formatNaira(payment.amount_kobo)} for “${request.title}” has been refunded. Access is closed.`,
      href: `/requests/${request.slug}`,
    });
    queueEmail({
      to: user.email,
      userId: payment.user_id,
      requestId: payment.request_id,
      template: "status_update",
      idempotencyKey: `refund:${reference}`,
      critical: true,
      data: {
        name: user.name ?? "there",
        title: request.title,
        statusLabel: "Refunded",
        blurb: `${formatNaira(payment.amount_kobo)} has been returned to your original payment method. Access to the lesson is now closed. Reason: ${reason}.`,
        path: `/requests/${request.slug}`,
      },
    });
  }

  return { ok: true, requestId: payment.request_id };
}

export function summaryForRequest(requestId: string) {
  const payment = row<any>(
    getDb().prepare("SELECT amount_kobo AS amountKobo, tax_kobo AS taxKobo, status, reference, paid_at AS paidAt FROM payments WHERE request_id = ? ORDER BY created_at DESC LIMIT 1"),
    requestId,
  );
  if (!payment) return null;
  return {
    amountKobo: Number(payment.amountKobo),
    taxKobo: Number(payment.taxKobo),
    status: String(payment.status),
    reference: String(payment.reference),
    paidAt: payment.paidAt as string | null,
    label: formatNaira(Number(payment.amountKobo)),
    taxLabel: formatNaira(Number(payment.taxKobo)),
  };
}

/* ------------------------------------------------------------------ */
/* Learner-initiated refunds                                           */
/* ------------------------------------------------------------------ */

/**
 * Fairness runs both ways: the creator can refund, and so can the person who
 * paid. A request is a *claim*, not a refund — the creator resolves it, so a
 * learner can never unilaterally pull access back mid-delivery, and never gets
 * ignored either, because every request is visible on both dashboards.
 */

export type RefundRequest = {
  id: string;
  payment_id: string;
  request_id: string;
  user_id: string;
  reason: string;
  status: "open" | "approved" | "declined";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
};

const REFUND_REASONS = [
  "The scope we agreed isn't what I need any more",
  "It arrived later than the agreed turnaround",
  "What was delivered doesn't match the agreed scope",
  "I no longer need this",
  "Something else",
] as const;

export const REFUND_REASON_OPTIONS = REFUND_REASONS;

export function requestRefund(input: {
  userId: string;
  requestId: string;
  reason: string;
}): { ok: true; id: string } | { ok: false; error: string } {
  const db = getDb();
  const payment = row<{ id: string; reference: string; user_id: string; status: string; amount_kobo: number }>(
    db.prepare("SELECT id, reference, user_id, status, amount_kobo FROM payments WHERE request_id = ? ORDER BY created_at DESC LIMIT 1"),
    input.requestId,
  );

  if (!payment) return { ok: false, error: "There's no payment on this request to refund." };
  if (payment.user_id !== input.userId) return { ok: false, error: "You can only ask about your own payment." };
  if (payment.status === "refunded") return { ok: false, error: "This payment has already been refunded." };
  if (payment.status !== "paid") return { ok: false, error: "Nothing has been charged yet, so there's nothing to refund." };

  const reason = input.reason.trim();
  if (reason.length < 10) return { ok: false, error: "Tell us what went wrong in a sentence or two — it helps us fix it." };

  const open = row<{ id: string }>(
    db.prepare("SELECT id FROM refund_requests WHERE request_id = ? AND status = 'open'"),
    input.requestId,
  );
  if (open) return { ok: false, error: "You already have a refund request open on this one. We're on it." };

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO refund_requests (id, payment_id, request_id, user_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
  ).run(id, payment.id, input.requestId, input.userId, reason.slice(0, 1000), now);

  const request = row<{ title: string; slug: string }>(
    db.prepare("SELECT title, slug FROM requests WHERE id = ?"),
    input.requestId,
  );

  notifyUser({
    userId: "usr_creator",
    kind: "payment",
    title: `Refund requested — ${formatNaira(Number(payment.amount_kobo))}`,
    body: `${request?.title ?? input.requestId}: ${reason.slice(0, 120)}`,
    href: "/admin/payments",
  });

  return { ok: true, id };
}

export function listRefundRequests(status?: RefundRequest["status"]): RefundRequest[] {
  const db = getDb();
  const sql = `
    SELECT rr.* FROM refund_requests rr
    ${status ? "WHERE rr.status = ?" : ""}
    ORDER BY CASE rr.status WHEN 'open' THEN 0 ELSE 1 END, rr.created_at DESC
  `;
  return status
    ? rows<RefundRequest>(db.prepare(sql), status)
    : rows<RefundRequest>(db.prepare(sql));
}

export function refundRequestFor(requestId: string): RefundRequest | null {
  return row<RefundRequest>(
    getDb().prepare("SELECT * FROM refund_requests WHERE request_id = ? ORDER BY created_at DESC LIMIT 1"),
    requestId,
  );
}

export function resolveRefundRequest(input: {
  id: string;
  approve: boolean;
  note: string;
}): { ok: boolean; error?: string } {
  const db = getDb();
  const claim = row<RefundRequest>(db.prepare("SELECT * FROM refund_requests WHERE id = ?"), input.id);
  if (!claim) return { ok: false, error: "That refund request doesn't exist." };
  if (claim.status !== "open") return { ok: false, error: "Already resolved." };

  const now = new Date().toISOString();

  if (input.approve) {
    const payment = row<{ reference: string }>(db.prepare("SELECT reference FROM payments WHERE id = ?"), claim.payment_id);
    if (!payment) return { ok: false, error: "The payment behind this request is missing." };
    const result = refund(payment.reference, `Learner refund: ${claim.reason}`);
    if (!result.ok) return { ok: false, error: result.error ?? "Refund failed." };
  }

  db.prepare("UPDATE refund_requests SET status = ?, resolution = ?, resolved_at = ? WHERE id = ?").run(
    input.approve ? "approved" : "declined",
    input.note.trim().slice(0, 1000) || null,
    now,
    input.id,
  );

  notifyUser({
    userId: claim.user_id,
    kind: "payment",
    title: input.approve ? "Refund approved" : "Refund request declined",
    body: input.approve
      ? "The money is on its way back to your original payment method, and access to the recording is closed."
      : input.note.trim() || "We couldn't approve this one. Reply to this notification and we'll explain and try again.",
    href: `/requests/${claim.request_id}`,
  });

  queueEmail({
    to: row<{ email: string }>(db.prepare("SELECT email FROM users WHERE id = ?"), claim.user_id)!.email,
    userId: claim.user_id,
    template: "status_update",
    idempotencyKey: `refund-claim:${claim.id}`,
    critical: true,
    data: {
      name: "there",
      heading: input.approve ? "Your refund is approved" : "Your refund request was declined",
      body: input.approve
        ? "We've refunded the payment to your original payment method. Access to the recording is closed, and nothing further will be charged."
        : input.note.trim() || "We couldn't approve this request. Reply and we'll explain — you can always ask again.",
      href: `/requests/${claim.request_id}`,
    },
  });

  return { ok: true };
}
