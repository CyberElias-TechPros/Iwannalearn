import type { Metadata } from "next";
import { getSetting } from "@/lib/service";
import { activeProvider, providerKeysPresent } from "@/lib/providers";
import { paymentsMode, PRICING, formatNaira, taxPortion } from "@/lib/pricing";
import { SettingsForm } from "@/components/admin/settings-form";
import { Badge } from "@/components/ui/badge";
import { Check, Close, Shield } from "@/components/icons";

export const metadata: Metadata = { title: "Settings — creator studio" };

export default async function AdminSettingsPage() {
  const vatRate = getSetting("vat_rate", "7.5");
  const refundWindow = getSetting("refund_window_days", "7");
  const supportEmail = getSetting("support_email", "hello@iwannalearn.app");
  const digestDay = getSetting("digest_day", "monday");
  const provider = activeProvider();
  const keysPresent = providerKeysPresent();

  const env = [
    { name: "SITE_URL", set: Boolean(process.env.SITE_URL), note: "Absolute links in emails and signed URLs." },
    { name: "PAYMENT_PROVIDER", set: Boolean(process.env.PAYMENT_PROVIDER), note: "mock · paystack · stripe" },
    { name: "PAYSTACK_SECRET_KEY", set: Boolean(process.env.PAYSTACK_SECRET_KEY), note: "Server-side only." },
    { name: "STRIPE_SECRET_KEY", set: Boolean(process.env.STRIPE_SECRET_KEY), note: "Server-side only." },
    { name: "STRIPE_WEBHOOK_SECRET", set: Boolean(process.env.STRIPE_WEBHOOK_SECRET), note: "Verifies /api/payments/webhook." },
    { name: "STREAM_SIGNING_SECRET", set: Boolean(process.env.STREAM_SIGNING_SECRET), note: "Private lesson link signing." },
    { name: "CRON_SECRET", set: Boolean(process.env.CRON_SECRET), note: "Guards /api/cron/digest." },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <section className="surface p-5">
          <h2 className="text-[15px] font-semibold">Money, windows and wording</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
            These values are read live: prices, invoices, the revision window and every email footer. Change them and
            the next payment uses the new numbers — no deploy.
          </p>
          <div className="mt-4">
            <SettingsForm
              settings={{ vatRate, refundWindow, supportEmail, digestDay }}
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="surface p-5">
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Shield size={15} className="text-brand" /> Current pricing
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              <li className="flex items-center justify-between gap-2">
                <span>Priority</span>
                <span className="font-medium">
                  {PRICING.priority.label}{" "}
                  <span className="text-[11.5px] text-ink-3">incl. {formatNaira(taxPortion(PRICING.priority.amountKobo, Number(vatRate)))} VAT</span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Private</span>
                <span className="font-medium">
                  {PRICING.private.label}{" "}
                  <span className="text-[11.5px] text-ink-3">incl. {formatNaira(taxPortion(PRICING.private.amountKobo, Number(vatRate)))} VAT</span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Community</span>
                <span className="font-medium">Free</span>
              </li>
            </ul>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Prices live in <code className="rounded bg-paper-2 px-1">lib/pricing.ts</code> so a change is deliberate and
              reviewable, not a typo in a form.
            </p>
          </section>

          <section className="surface p-5">
            <h2 className="text-[15px] font-semibold">Payment provider</h2>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Mode: <strong>{paymentsMode()}</strong> · provider: <strong>{provider}</strong>
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
              {keysPresent
                ? "Keys present. Webhooks verify signatures and settle by reference."
                : "No live keys. Checkout runs in test mode: the same server-side settlement path, no money."}
            </p>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Webhook endpoint: <code className="rounded bg-paper-2 px-1">/api/payments/webhook</code>
            </p>
          </section>
        </div>
      </div>

      <section className="surface p-5">
        <h2 className="text-[15px] font-semibold">Environment</h2>
        <p className="mt-1 text-[12.5px] text-ink-3">
          What this deployment has wired. Absent values fall back to safe defaults rather than crashing.
        </p>
        <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {env.map((variable) => (
            <li key={variable.name} className="flex items-start justify-between gap-2 rounded-lg bg-paper-2/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[11.5px]">{variable.name}</p>
                <p className="text-[11px] text-ink-3">{variable.note}</p>
              </div>
              <Badge tone={variable.set ? "success" : "neutral"}>
                {variable.set ? <Check size={11} /> : <Close size={11} />} {variable.set ? "set" : "default"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
