import Link from "next/link";
import type { Metadata } from "next";
import { adminQueue } from "@/lib/queries";
import { ModerationDecision } from "@/components/admin/moderation-decision";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, ArrowRight, Shield } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Moderation — creator studio" };

export default async function ModerationPage() {
  const queue = adminQueue();
  const flagged = queue.filter((item) => item.moderationFlag && item.status !== "declined");
  const awaiting = queue.filter((item) => ["submitted", "under_review"].includes(item.status) && !item.moderationFlag);

  return (
    <div className="space-y-4">
      <section className="surface p-4 md:p-5">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <Shield size={15} className="text-brand" /> Screen before you film
        </h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
          Requests are auto-screened against the not-covered list (medical, legal and investment advice, do-my-work,
          and anything requiring someone else&apos;s data without consent). Flagging is a prompt to read carefully, not
          a verdict — your decision and its reason are recorded and shown to the learner.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11.5px]">
          <Badge tone={flagged.length ? "warn" : "success"} dot>
            {flagged.length} flagged
          </Badge>
          <Badge tone="neutral">{awaiting.length} awaiting a first decision</Badge>
          <Link href="/legal/not-covered" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            Policy page <ArrowRight size={11} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="flagged-heading">
        <h2 id="flagged-heading" className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
          Flagged ({flagged.length})
        </h2>
        {flagged.length === 0 ? (
          <EmptyState
            icon={<Shield size={20} />}
            title="Nothing flagged"
            body="No request currently trips the not-covered screen. New ones are checked the moment they're filed."
          />
        ) : (
          <ul className="space-y-2.5">
            {flagged.map((item) => (
              <li key={item.id} className="surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/requests/${item.slug}`} className="text-[14px] font-semibold hover:text-brand">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      {item.ref} · {item.category} · {item.ownerName ?? item.ownerEmail} · {relativeTime(item.createdAt)}
                    </p>
                  </div>
                  <Badge tone="warn" dot>
                    {item.tier}
                  </Badge>
                </div>

                <p className="mt-2 rounded-lg border border-warn/25 bg-warn-soft/50 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
                  <Alert size={12} className="mr-1 inline text-warn" />
                  {item.moderationNote ?? "Flagged by the intake screen."}
                </p>

                {item.goal && (
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-2">“{item.goal}”</p>
                )}

                <ModerationDecision requestId={item.id} title={item.title} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="awaiting-heading">
        <h2 id="awaiting-heading" className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
          Awaiting a first decision ({awaiting.length})
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">Clear. Every filed request has been moved.</p>
        ) : (
          <ul className="surface divide-y divide-line/70">
            {awaiting.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <Link href={`/requests/${item.slug}`} className="block truncate text-[13px] font-medium hover:text-brand">
                    {item.title}
                  </Link>
                  <p className="text-[11px] text-ink-3">
                    {item.ref} · {item.tier} · {relativeTime(item.createdAt)}
                  </p>
                </div>
                <ModerationDecision requestId={item.id} title={item.title} compact />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
