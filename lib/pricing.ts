import { getSetting } from "./service";

/**
 * Money.
 *
 * Amounts are stored in kobo (₦1 = 100 kobo) as integers — never floats.
 * Tax is treated as inclusive of the displayed price, which is what Nigerian
 * consumer pricing expects, and the invoice shows the portion.
 */

export type PaidTier = "priority" | "private";

export const PRICING: Record<PaidTier, { amountKobo: number; label: string; blurb: string }> = {
  priority: {
    amountKobo: 400_000,
    label: "₦4,000",
    blurb: "A place at the front of the filming queue. The lesson still becomes public library content.",
  },
  private: {
    amountKobo: 2_500_000,
    label: "₦25,000",
    blurb: "A bespoke walkthrough of your own project or files. Never published; access stays with you.",
  },
};

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Math.round(kobo) / 100);
}

export function taxPortion(amountKobo: number, ratePercent = Number(getSetting("vat_rate", "7.5"))): number {
  if (!ratePercent) return 0;
  return Math.round((amountKobo * ratePercent) / (100 + ratePercent));
}

export type PaymentsMode = "off" | "mock" | "live";

export function paymentsMode(): PaymentsMode {
  const configured = process.env.PAYMENTS_MODE as PaymentsMode | undefined;
  if (configured === "live" || configured === "mock" || configured === "off") return configured;
  const stored = getSetting("payments_mode", "mock") as PaymentsMode;
  return stored === "live" || stored === "mock" ? stored : "off";
}

export function paymentsEnabled(): boolean {
  return paymentsMode() !== "off";
}

export function newReference(ref: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const noise = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IWL-${ref.replace("REQ-", "")}-${stamp}${noise}`;
}
