import Link from "next/link";
import type { Metadata } from "next";
import { getOutboxItem, listOutbox } from "@/lib/queries";
import { getDb, rows } from "@/lib/db";
import { EmailActions, ClearBounceButton, DigestButton } from "@/components/admin/email-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Mail, Refresh } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Outbox — creator studio" };

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const emails = listOutbox(40);
  const selected = id ? getOutboxItem(id) : null;
  const bounced = rows<{ id: string; email: string; name: string | null; email_bounced_at: string }>(
    getDb().prepare("SELECT id, email, name, email_bounced_at FROM users WHERE email_bounced_at IS NOT NULL"),
  );

  return (
    <div className="space-y-4">
      <section className="surface flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Mail size={15} className="text-brand" /> Every email the app &ldquo;sent&rdquo;
          </h2>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-ink-3">
            The transport is stubbed, so nothing leaves the machine — but the record is real: subject, body, attempts,
            provider status and an idempotency key that stops retries sending twice. Swapping in Resend or Postmark
            changes one function.
          </p>
        </div>
        <DigestButton />
      </section>

      {bounced.length > 0 && (
        <section className="rounded-2xl border border-warn/25 bg-warn-soft/50 p-4">
          <h2 className="text-[13.5px] font-semibold text-warn">Bounced addresses</h2>
          <p className="mt-0.5 text-[12px] text-ink-2">
            Email to these is suppressed (in-app notifications still work). Clear a bounce once you know the address is
            fixed.
          </p>
          <ul className="mt-2 space-y-1.5">
            {bounced.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
                <div>
                  <p className="text-[12.5px] font-medium">{person.email}</p>
                  <p className="text-[11px] text-ink-3">
                    {person.name ?? "Learner"} · bounced {relativeTime(person.email_bounced_at)}
                  </p>
                </div>
                <ClearBounceButton userId={person.id} email={person.email} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <div className="surface overflow-hidden">
          {emails.length === 0 ? (
            <EmptyState
              icon={<Mail size={20} />}
              title="Outbox is empty"
              body="Email is created when someone files a request or a lesson is published. File a request and it'll appear here."
            />
          ) : (
            <ul className="max-h-[34rem] divide-y divide-line/70 overflow-y-auto">
              {emails.map((email) => (
                <li key={email.id}>
                  <Link
                    href={`/admin/outbox?id=${email.id}`}
                    aria-current={email.id === id ? "true" : undefined}
                    className={`block px-3.5 py-2.5 transition hover:bg-paper-2/60 ${email.id === id ? "bg-paper-2" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12.5px] font-medium">{email.subject}</p>
                      <Badge
                        tone={
                          email.logStatus === "delivered"
                            ? "success"
                            : email.logStatus === "bounced"
                              ? "danger"
                              : email.logStatus === "suppressed"
                                ? "warn"
                                : "neutral"
                        }
                      >
                        {email.logStatus ?? email.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-ink-3">
                      {email.toEmail} · {relativeTime(email.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface min-h-[20rem] p-4 md:p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11.5px] uppercase tracking-wide text-ink-3">To {selected.toEmail}</p>
                  <h2 className="mt-0.5 text-[16px] font-semibold leading-snug">{selected.subject}</h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={selected.logStatus === "delivered" ? "success" : selected.logStatus === "bounced" ? "danger" : "neutral"} dot>
                    {selected.logStatus ?? selected.status}
                  </Badge>
                  <span className="text-[11px] text-ink-3">{selected.attempts ?? 0} attempt(s)</span>
                </div>
              </div>

              {selected.lastError && (
                <p className="mt-2 rounded-lg border border-warn/25 bg-warn-soft/60 px-3 py-2 text-[12px] text-ink-2">
                  {selected.lastError}
                </p>
              )}

              {selected.ref && (
                <Link
                  href={`/requests/${selected.slug}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline"
                >
                  {selected.ref} <ArrowRight size={11} />
                </Link>
              )}

              <div className="mt-3 rounded-xl border border-line bg-paper-2/40 p-3">
                <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-ink-2">
                  {selected.body}
                </pre>
              </div>

              {selected.html && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] font-medium text-ink-3">Show HTML version</summary>
                  <iframe
                    title="Email HTML preview"
                    srcDoc={selected.html}
                    sandbox=""
                    className="mt-2 h-72 w-full rounded-lg border border-line bg-white"
                  />
                </details>
              )}

              <div className="mt-3">
                <EmailActions outboxId={selected.id} email={selected.toEmail} />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-2 text-ink-3">
                <Refresh size={18} />
              </span>
              <p className="mt-2.5 text-[13px] font-medium">Pick a message</p>
              <p className="mt-0.5 max-w-xs text-[12px] text-ink-3">
                You&apos;ll see the exact words a learner would read — plain text first, HTML underneath.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
