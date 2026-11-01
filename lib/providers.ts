import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment provider adapters.
 *
 * `mock` is the default and needs no keys: checkout renders locally and settles
 * through the same server-side `settle()` a webhook would call, so the whole
 * path (pending → paid → entitlement → receipt → refund) is real.
 *
 * Paystack and Stripe are thin: create a hosted checkout, then verify the
 * webhook signature and settle by reference. Nothing else in the app knows
 * which one ran.
 */

export type ProviderName = "mock" | "paystack" | "stripe";

export function activeProvider(): ProviderName {
  const configured = process.env.PAYMENT_PROVIDER as ProviderName | undefined;
  if (configured === "paystack" || configured === "stripe") return configured;
  return "mock";
}

export function providerKeysPresent(): boolean {
  const provider = activeProvider();
  if (provider === "paystack") return Boolean(process.env.PAYSTACK_SECRET_KEY);
  if (provider === "stripe") return Boolean(process.env.STRIPE_SECRET_KEY);
  return true;
}

export type CheckoutRequest = {
  reference: string;
  amountKobo: number;
  email: string;
  title: string;
  callbackUrl: string;
};

export type CheckoutSession = { url: string; provider: ProviderName };

/**
 * Creates a hosted checkout. With no keys configured this returns the internal
 * `/checkout/<reference>` page, which behaves exactly like a provider redirect.
 */
export async function createProviderCheckout(input: CheckoutRequest): Promise<CheckoutSession> {
  const provider = activeProvider();

  if (provider === "paystack" && process.env.PAYSTACK_SECRET_KEY) {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference: input.reference,
        amount: input.amountKobo,
        currency: "NGN",
        email: input.email,
        callback_url: input.callbackUrl,
        metadata: { title: input.title },
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { data?: { authorization_url?: string } };
      if (payload.data?.authorization_url) {
        return { url: payload.data.authorization_url, provider: "paystack" };
      }
    }
    // Fall through to the internal page rather than stranding the learner.
  }

  if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "ngn",
      "line_items[0][price_data][unit_amount]": String(input.amountKobo),
      "line_items[0][price_data][product_data][name]": input.title,
      "line_items[0][quantity]": "1",
      client_reference_id: input.reference,
      success_url: `${input.callbackUrl}?reference=${input.reference}`,
      cancel_url: input.callbackUrl,
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (response.ok) {
      const payload = (await response.json()) as { url?: string };
      if (payload.url) return { url: payload.url, provider: "stripe" };
    }
  }

  return { url: `/checkout/${input.reference}`, provider: "mock" };
}

/**
 * Verifies a webhook body. Stripe signs `<timestamp>.<body>`; Paystack signs the
 * raw body with the secret key. Both are HMAC-SHA256 hex.
 */
export function verifyWebhookSignature(
  provider: "paystack" | "stripe",
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): { ok: boolean; reason?: string } {
  if (!secret) return { ok: false, reason: "No webhook secret configured." };
  if (!signature) return { ok: false, reason: "Missing signature header." };

  if (provider === "paystack") {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return constantTimeEquals(expected, signature)
      ? { ok: true }
      : { ok: false, reason: "Signature mismatch." };
  }

  // Stripe: header is `t=<timestamp>,v1=<signature>`
  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});
  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided) return { ok: false, reason: "Malformed Stripe signature." };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return constantTimeEquals(expected, provided) ? { ok: true } : { ok: false, reason: "Signature mismatch." };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Extracts the money-relevant bits from either provider's payload.
 * Returns null when the event isn't a successful payment.
 */
export function readWebhookEvent(
  provider: "paystack" | "stripe",
  payload: any,
): { reference: string; amountKobo: number | null; paid: boolean } | null {
  if (provider === "paystack") {
    if (payload?.event !== "charge.success") return null;
    return {
      reference: String(payload.data?.reference ?? ""),
      amountKobo: payload.data?.amount ?? null,
      paid: String(payload.data?.status ?? "") === "success",
    };
  }

  const type = String(payload?.type ?? "");
  if (type !== "checkout.session.completed" && type !== "payment_intent.succeeded") return null;
  const object = payload?.data?.object ?? {};
  return {
    reference: String(object.client_reference_id ?? object.metadata?.reference ?? ""),
    amountKobo: object.amount_total ?? object.amount_received ?? null,
    paid: true,
  };
}
