import Link from "next/link";
import type { Metadata } from "next";
import { listPayments, paymentSummary } from "@/lib/queries";
import { formatNaira, paymentsMode, PRICING } from "@/lib/pricing";
import { getSetting } from "@/lib/service";
import { PaymentsModeForm, RefundButton } from "@/components/admin/payment-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt, ArrowRight } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Payments — creator studio" };

export default async function AdminPaymentsPage() {
  const payments = listPayments();
  const summary = paymentSummary();
  const mode = paymentsMode();
  const vat = Number(getSetting("vat_rate", "7.5"));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Collected", value: formatNaira(summary.revenueKobo), hint: `${summary.paid} paid` },
          { label: "VAT within that", value: formatNaira(summary.taxKobo), hint: `${vat}% inclusive` },
          { label: "Refunded", value: summary.refunded ? String(summary.refunded) : "0", hint: "access revoked" },
          { label: "Private price", value: PRICING.private.label, hint: `priority ${PRICING.priority.label}` },
        ].map((card) => (
          <div key={card.label} className="surface p-4">
            <p className="text-[11.5px] uppercase tracking-wide text-ink-3">{card.label}</p>
            <p className="font-display text-[22px] font-semibold leading-tight">{card.value}</p>
            <p className="text-[11.5px] text-ink-3">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="surface p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">How money moves here</h2>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
              Checkout creates a <code className="rounded bg-paper-2 px-1 text-[11.5px]">pending</code> payment; only a
              verified server-side settlement flips it to <code className="rounded bg-paper-2 px-1 text-[11.5px]">paid</code>,
              grants an entitlement and emails a receipt. Refunds revoke access automatically. Settlement is idempotent
              by reference, so a replayed webhook can&apos;t double-grant.
            </p>
          </div>
          <PaymentsModeForm mode={mode} />
        </div>
      </section>

      {payments.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No payments yet"
          body="When someone pays for a priority slot or a private commission, it lands here with the reference, tax split and refund controls."
        />
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-paper-2/60 text-[11px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-2 font-semibold">Request</th>
                <th className="px-4 py-2 font-semibold">Learner</th>
                <th className="px-4 py-2 font-semibold">Amount</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {payments.map((payment) => (
                <tr key={payment.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <Link href={`/requests/${payment.slug}`} className="font-medium hover:text-brand">
                      {payment.ref}
                    </Link>
                    <p className="max-w-[16rem] truncate text-[11.5px] text-ink-3">{payment.title}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{payment.learner ?? "—"}</p>
                    <p className="text-[11px] text-ink-3">{payment.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium tabular-nums">{formatNaira(payment.amountKobo)}</p>
                    <p className="text-[11px] text-ink-3">incl. {formatNaira(payment.taxKobo)} VAT</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={payment.status === "paid" ? "success" : payment.status === "refunded" ? "warn" : "neutral"}
                      dot
                    >
                      {payment.status}
                    </Badge>
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">{payment.reference}</p>
                  </td>
                  <td className="px-4 py-2.5 text-ink-3">
                    {relativeTime(payment.paidAt ?? payment.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {payment.status === "paid" ? (
                      <RefundButton reference={payment.reference} amountLabel={formatNaira(payment.amountKobo)} />
                    ) : payment.status === "pending" ? (
                      <Link
                        href={`/checkout/${payment.reference}`}
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline"
                      >
                        Open checkout <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <span className="text-[11.5px] text-ink-3">closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
