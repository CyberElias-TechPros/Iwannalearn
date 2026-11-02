import { NextResponse } from "next/server";
import { activeProvider, readWebhookEvent, verifyWebhookSignature } from "@/lib/providers";
import { getPayment, settle } from "@/lib/payments";
import { track } from "@/lib/service";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Provider webhook. This is the only place money is ever confirmed.
 *
 * - reads the raw body (signature is over the exact bytes),
 * - verifies the provider signature,
 * - settles by reference (idempotent, so replays are harmless),
 * - never trusts an amount without comparing it to what we asked for.
 */
export async function POST(request: Request) {
  const provider = activeProvider();
  if (provider === "mock") {
    return NextResponse.json(
      { ok: false, error: "Mock provider has no webhook. Settle through the checkout page." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const signature =
    provider === "paystack"
      ? request.headers.get("x-paystack-signature")
      : request.headers.get("stripe-signature");

  const secret =
    provider === "paystack" ? process.env.PAYSTACK_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;

  const verification = verifyWebhookSignature(provider, rawBody, signature, secret);
  if (!verification.ok) {
    // Log the rejection — a burst of these is either a misconfigured secret or an attack.
    track("webhook_rejected", { data: { provider, reason: verification.reason } });
    return NextResponse.json({ ok: false, error: verification.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Body was not JSON." }, { status: 400 });
  }

  const event = readWebhookEvent(provider, payload);
  if (!event || !event.reference) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!event.paid) {
    return NextResponse.json({ ok: true, ignored: "not paid" });
  }

  const payment = getPayment(event.reference);
  if (!payment) {
    track("webhook_unknown_reference", { data: { provider, reference: event.reference } });
    return NextResponse.json({ ok: false, error: "Unknown reference." }, { status: 404 });
  }

  // Never settle a different amount than the one we asked for.
  if (event.amountKobo !== null && Number(event.amountKobo) !== Number(payment.amount_kobo)) {
    track("webhook_amount_mismatch", {
      data: { provider, reference: event.reference, expected: payment.amount_kobo, got: event.amountKobo },
    });
    getDb()
      .prepare("UPDATE payments SET updated_at = ? WHERE reference = ?")
      .run(new Date().toISOString(), event.reference);
    return NextResponse.json({ ok: false, error: "Amount mismatch." }, { status: 409 });
  }

  const result = settle(event.reference, { provider, signal: "webhook" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  track("payment_settled", { data: { provider, reference: event.reference, replay: Boolean(result.alreadySettled) } });
  return NextResponse.json({ ok: true, replay: Boolean(result.alreadySettled) });
}

/** Providers probe the endpoint with GET when you save it in their dashboard. */
export async function GET() {
  return NextResponse.json({ ok: true, provider: activeProvider() });
}
