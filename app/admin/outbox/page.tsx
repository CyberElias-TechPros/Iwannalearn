import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listOutbox } from "@/lib/queries";
import { ArrowLeft, Inbox, Mail } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Outbox" };

export default async function OutboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/outbox");
  if (user.role !== "creator") redirect("/admin");

  const emails = listOutbox(40);

  return (
    <div className="wrap max-w-4xl py-8 md:py-10">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-brand">
        <ArrowLeft size={14} /> Back to the studio
      </Link>

      <header className="mt-4">
        <h1 className="text-[clamp(1.7rem,3.4vw,2.2rem)] font-semibold">Outbox</h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          Every notification the product would have emailed, captured verbatim. This is the delivery layer made
          visible: swap the stub for Resend or Postmark and the rest of the loop is unchanged.
        </p>
      </header>

      <div className="mt-5 rounded-2xl border border-warn/25 bg-warn-soft/50 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
        <strong className="font-semibold">Heads up:</strong> nothing is actually sent in this build. Messages are queued
        here so you can verify exactly who would be told, and what they&apos;d read.
      </div>

      {emails.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-paper-2/40 px-6 py-12 text-center">
          <Inbox size={24} className="mx-auto text-ink-3" />
          <p className="mt-2 text-[14px] font-medium">Nothing in the outbox</p>
          <p className="mt-1 text-[13px] text-ink-3">Publish a lesson and the notifications will appear here.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {emails.map((email) => (
            <li key={email.id}>
              <details className="surface group overflow-hidden">
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper-2/40">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Mail size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{email.subject}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                      to {email.toEmail} · {relativeTime(email.createdAt)}
                      {email.ref ? ` · ${email.ref}` : ""}
                    </span>
                  </span>
                  <Badge tone={email.status === "delivered" ? "success" : "neutral"}>{email.status}</Badge>
                </summary>
                <div className="border-t border-line bg-paper-2/30 p-4">
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-2">{email.body}</pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
