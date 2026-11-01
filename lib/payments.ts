import { getDb, row, randomUUID } from "./db";
import { PRICING, formatNaira, newReference, paymentsEnabled, taxPortion, type PaidTier } from "./pricing";
import { notifyUser, queueEmail } from "./notify";
import { createProviderCheckout } from "./providers";
import { getSetting } from "./service";

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

  const amountKobo = PRICING[kind].amountKobo;
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
