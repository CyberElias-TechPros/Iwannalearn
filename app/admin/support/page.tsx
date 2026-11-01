import Link from "next/link";
import type { Metadata } from "next";
import { listSupportMessages } from "@/lib/queries";
import { getSetting } from "@/lib/service";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Mail, ArrowRight } from "@/components/icons";
import { relativeTime } from "@/lib/status";

export const metadata: Metadata = { title: "Support — creator studio" };

export default async function AdminSupportPage() {
  const messages = listSupportMessages(30);
  const supportEmail = getSetting("support_email", "hello@iwannalearn.app");

  return (
    <div className="space-y-4">
      <section className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Mail size={15} className="text-brand" /> Messages from learners
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Everything sent through the contact form. Reply from your own inbox — no ticket system needed at this size.
          </p>
        </div>
        <a
          href={`mailto:${supportEmail}`}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:border-brand/30 hover:text-brand"
        >
          {supportEmail}
        </a>
      </section>

      {messages.length === 0 ? (
        <EmptyState
          icon={<Mail size={20} />}
          title="No messages yet"
          body="When someone uses the contact form it appears here, with their email and the exact text so you can reply straight from your inbox."
        />
      ) : (
        <ul className="space-y-2.5">
          {messages.map((message) => (
            <li key={message.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold">{message.subject}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    {message.email} · {relativeTime(message.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={message.status === "open" ? "accent" : "success"} dot>
                    {message.status}
                  </Badge>
                  <a
                    href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand hover:underline"
                  >
                    Reply <ArrowRight size={11} />
                  </a>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">{message.body}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] text-ink-3">
        Tip: keep answers short and link to{" "}
        <Link href="/legal/not-covered" className="font-medium text-brand hover:underline">
          the policy
        </Link>{" "}
        instead of re-explaining it. It&apos;s the same answer every time, and it&apos;s kinder to the person asking.
      </p>
    </div>
  );
}
