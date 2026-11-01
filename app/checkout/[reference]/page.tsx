import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPayment } from "@/lib/payments";
import { confirmMockPaymentFormAction } from "@/lib/actions";
import { formatNaira, paymentsMode, PRICING } from "@/lib/pricing";
import { getSetting } from "@/lib/service";
import { getDb, row } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Shield, ArrowRight } from "@/components/icons";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { reference } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/checkout/${reference}`);

  const payment = getPayment(reference);
  if (!payment) notFound();

  const request = row<{ id: string; slug: string; title: string; tier: string; created_by: string }>(
    getDb().prepare("SELECT id, slug, title, tier, created_by FROM requests WHERE id = ?"),
    payment.request_id,
  );
  if (!request) notFound();

  if (payment.user_id !== user.id) {
    return (
      <div className="wrap max-w-lg py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Lock size={22} />
        </span>
        <h1 className="mt-4 text-[24px] font-semibold">This checkout isn&apos;t yours</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">
          Payment references are tied to the account that created them.
        </p>
        <Link href="/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand hover:underline">
          Back to my learning <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const mode = paymentsMode();
  const settled = payment.status === "paid";
  const kind = payment.kind as "priority" | "private";
  const windowDays = Number(getSetting("refund_window_days", "7"));

  return (
    <div className="wrap max-w-3xl py-10 md:py-14">
      <Link href={`/requests/${request.slug}`} className="text-[13px] font-medium text-ink-3 hover:text-brand">
        ← Back to your request
      </Link>

      <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div className="surface overflow-hidden">
          <div className="border-b border-line bg-paper-2/50 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Checkout</p>
              <Badge tone={mode === "live" ? "success" : "warn"} dot>
                {mode === "live" ? "Live" : "Test mode"}
              </Badge>
            </div>
            <h1 className="mt-2 text-[20px] font-semibold leading-snug">{request.title}</h1>
          </div>

          <div className="space-y-4 p-5">
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-3">{kind === "private" ? "Private lesson" : "Priority slot"}</dt>
                <dd className="font-medium">{PRICING[kind].label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <dt className="text-ink-3">VAT included (7.5%)</dt>
                <dd className="text-ink-2">{formatNaira(payment.tax_kobo)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-2 text-[16px]">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display font-semibold">{formatNaira(payment.amount_kobo)}</dd>
              </div>
            </dl>

            <div className="rounded-xl border border-info/25 bg-info-soft/40 p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-info">
                <Shield size={13} /> What you&apos;re agreeing to
              </p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
                <li>· The scope above, as described on your request — new scope is a new request.</li>
                <li>· One revision within {windowDays} days of delivery for private work.</li>
                <li>
                  · {kind === "private"
                    ? "The recording is yours to use; it is never published and access is revocable on refund."
                    : "The lesson is public library content, reusable by everyone."}
                </li>
              </ul>
              <div className="mt-1.5 flex gap-3 text-[12px]">
                <Link href="/legal/terms" className="font-medium text-brand hover:underline">
                  Terms
                </Link>
                <Link href="/legal/privacy" className="font-medium text-brand hover:underline">
                  Privacy
                </Link>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}

            {settled ? (
              <div className="rounded-xl border border-brand/25 bg-brand-soft/60 p-4">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-brand-strong">
                  <Check size={15} /> Paid — {formatNaira(payment.amount_kobo)}
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  Receipt sent. Work starts now; you&apos;ll be notified the moment the lesson is ready.
                </p>
                <Link
                  href={`/requests/${request.slug}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
                >
                  Back to the request <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <form action={confirmMockPaymentFormAction}>
                <input type="hidden" name="reference" value={reference} />
                <Button type="submit" className="w-full justify-center">
                  <Lock size={15} /> Pay {formatNaira(payment.amount_kobo)}
                </Button>
              </form>
            )}

            <p className="text-[11.5px] leading-relaxed text-ink-3">
              {mode === "live"
                ? "You'll be redirected to the provider. Payment is verified server-side — a redirect alone never marks anything as paid."
                : "Test mode: pressing pay settles the payment on the server exactly as a provider webhook would — pending, verified, entitlement granted, receipt queued. No card required, no money moves."}
            </p>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="surface p-5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Reference</p>
            <p className="mt-1 break-all font-mono text-[12.5px]">{reference}</p>
            <p className="mt-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Status</p>
            <p className="mt-1 text-[13px] capitalize">{payment.status}</p>
          </div>

          <div className="rounded-2xl border border-line bg-card/60 p-4">
            <p className="text-[12.5px] font-semibold">Changed your mind?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              Nothing is charged until you press pay. You can close this page and your request stays exactly as it
              was — no penalty, no follow-up email chasing you.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-card/60 p-4">
            <p className="text-[12.5px] font-semibold">Need to talk first?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              If the scope looks wrong, don&apos;t pay — message us and we&apos;ll fix it or tell you honestly that
              it&apos;s not a fit.
            </p>
            <Link href="/contact" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline">
              Message us <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
