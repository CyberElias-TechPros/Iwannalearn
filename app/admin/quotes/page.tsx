import Link from "next/link";
import type { Metadata } from "next";
import { getDb, rows } from "@/lib/db";
import { formatNaira, PRICING, type PaidTier } from "@/lib/pricing";
import { suggestedScope, minimumFor } from "@/lib/quotes";
import { QuoteComposer } from "@/components/admin/quote-composer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Clock, Sparkle } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Quotes — creator studio" };

type Row = {
  id: string;
  ref: string;
  slug: string;
  title: string;
  tier: "priority" | "private";
  owner_name: string | null;
  payment_status: string;
  quote_id: string | null;
  amount_kobo: number | null;
  quote_status: string | null;
  proposed_at: string | null;
  decline_note: string | null;
};

export default async function AdminQuotesPage() {
  // Access is enforced by app/admin/layout.tsx (creator role or redirect).

  // Every paid request either has a live quote or needs one. Free requests are
  // deliberately absent: no quote, no money, nothing to discuss.
  const open = rows<Row>(
    getDb().prepare(`
      SELECT r.id, r.ref, r.slug, r.title, r.tier, u.name AS owner_name, r.payment_status,
             q.id AS quote_id, q.amount_kobo, q.status AS quote_status, q.proposed_at, q.decline_note
      FROM requests r
      LEFT JOIN quotes q ON q.request_id = r.id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.tier IN ('priority', 'private')
        AND r.status NOT IN ('declined', 'cancelled')
        AND r.payment_status != 'paid'
      ORDER BY (q.status = 'proposed') ASC, r.created_at DESC
    `),
  );

  const accepted = rows<Row>(
    getDb().prepare(`
      SELECT r.id, r.ref, r.slug, r.title, r.tier, u.name AS owner_name, r.payment_status,
             q.id AS quote_id, q.amount_kobo, q.status AS quote_status, q.proposed_at, q.decline_note
      FROM requests r
      JOIN quotes q ON q.request_id = r.id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE q.status = 'accepted' AND r.payment_status != 'paid'
      ORDER BY q.accepted_at DESC
    `),
  );

  const awaiting = open.filter((row) => row.quote_status === "proposed").length;
  const unquoted = open.filter((row) => !row.quote_id).length;
  const agreedKobo = accepted.reduce((sum, row) => sum + Number(row.amount_kobo ?? 0), 0);

  return (
    <div className="space-y-5">
      <section className="surface p-4 md:p-5">
        <h2 className="text-[15px] font-semibold">Scope first, money second</h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
          A learner never sees a pay button until they&apos;ve accepted a quote. Send the scope, they accept or decline,
          and only then does checkout unlock — for the exact amount you both agreed. Nothing here charges anyone.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Waiting on the learner", value: String(awaiting) },
            { label: "Need a quote", value: String(unquoted) },
            { label: "Accepted, not yet paid", value: `${accepted.length} · ${formatNaira(agreedKobo)}` },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-line bg-paper-2/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-ink-3">{card.label}</p>
              <p className="font-display text-[19px] font-semibold leading-tight tabular-nums">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      {open.length === 0 ? (
        <EmptyState
          icon={<Sparkle size={20} />}
          title="No paid requests waiting"
          body="When someone asks for a priority slot or a private lesson, it appears here so you can agree the scope and price before any money moves."
        />
      ) : (
        <div className="space-y-3">
          {open.map((row) => {
            const tier = row.tier as PaidTier;
            const defaults = suggestedScope(tier, row.title);
            const floor = minimumFor(tier);
            return (
              <article key={row.id} className="surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={tier === "private" ? "info" : "accent"}>
                        {tier === "private" ? "Private" : "Priority"}
                      </Badge>
                      <span className="font-mono text-[11px] text-ink-3">{row.ref}</span>
                      {row.quote_status === "proposed" && <Badge tone="warn">Awaiting reply</Badge>}
                      {row.quote_status === "declined" && <Badge tone="danger">Declined</Badge>}
                      {row.payment_status === "pending" && <Badge tone="neutral">Checkout started</Badge>}
                    </div>
                    <h3 className="mt-1 text-[14.5px] font-semibold leading-snug">
                      <Link href={`/requests/${row.slug}`} className="hover:underline">
                        {row.title}
                      </Link>
                    </h3>
                    <p className="text-[12px] text-ink-3">
                      {row.owner_name ?? "Learner"}
                      {row.amount_kobo ? ` · quoted ${formatNaira(Number(row.amount_kobo))}` : ""}
                      {row.proposed_at ? ` · ${relativeTime(row.proposed_at)}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/requests/${row.slug}`}
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
                  >
                    Open request <ArrowRight size={13} />
                  </Link>
                </div>

                {row.quote_status === "declined" && row.decline_note && (
                  <p className="mt-2 rounded-lg border border-danger/20 bg-danger-soft px-2.5 py-1.5 text-[12px] text-danger">
                    They said: “{row.decline_note}”
                  </p>
                )}

                <div className="mt-3">
                  <QuoteComposer
                    requestId={row.id}
                    tier={tier}
                    title={row.title}
                    floorLabel={PRICING[tier].label}
                    defaults={defaults}
                    existing={row.amount_kobo ? { amountKobo: Number(row.amount_kobo), status: row.quote_status ?? "" } : null}
                  />
                </div>
                <p className="mt-2 text-[11px] text-ink-3">
                  Floor {formatNaira(floor)} · VAT is shown inside the price, never added on top.
                </p>
              </article>
            );
          })}
        </div>
      )}

      {accepted.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
              <Clock size={14} className="text-brand" /> Accepted, payment not in yet
            </h2>
            <p className="text-[12px] text-ink-3">Nothing starts until the payment clears. No chasing needed — they get a receipt either way.</p>
          </div>
          <ul className="divide-y divide-line">
            {accepted.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/requests/${row.slug}`} className="truncate text-[13px] font-medium hover:underline">
                    {row.title}
                  </Link>
                  <p className="text-[11.5px] text-ink-3">
                    {row.owner_name ?? "Learner"} · {row.ref}
                  </p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums">{formatNaira(Number(row.amount_kobo ?? 0))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
