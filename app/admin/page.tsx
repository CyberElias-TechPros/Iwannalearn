import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { adminQueue, adminStats, getFeedbackSummary, listInternalNotes, listOutbox } from "@/lib/queries";
import { QueueBoard } from "@/components/admin/queue-board";
import { CapacityForm } from "@/components/admin/capacity-form";
import { signInAsDemoAction } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Bell, Check, Clock, Inbox, Lock, Plus, Sparkle, Video } from "@/components/icons";
import { plural } from "@/lib/status";
import { formatNaira } from "@/lib/pricing";

export const metadata: Metadata = { title: "Creator studio" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  if (user.role !== "creator") {
    return (
      <div className="wrap max-w-xl py-16">
        <div className="surface p-7 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-[#8a5209]">
            <Lock size={22} />
          </span>
          <h1 className="mt-4 text-[24px] font-semibold">This one&apos;s for the creator</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
            You&apos;re signed in as {user.email}. The studio holds every request, private note and payment detail, so it
            stays behind the creator account.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <form action={signInAsDemoAction}>
              <input type="hidden" name="userId" value="usr_creator" />
              <input type="hidden" name="next" value="/admin" />
              <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-[14.5px] font-medium text-white hover:bg-brand-strong">
                Switch to the creator demo <ArrowRight size={15} />
              </button>
            </form>
            <ButtonLink href="/dashboard" variant="secondary">
              Back to my learning
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const items = adminQueue();
  const stats = adminStats();
  const feedback = getFeedbackSummary();
  const notes = Object.fromEntries(items.map((item) => [item.id, listInternalNotes(item.id)]));
  const outbox = listOutbox(3);

  return (
    <div>
      <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-2">
        One screen for the whole loop: decide, film, publish. Publishing notifies everyone who asked or voted — no
        manual email.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Waiting on you", value: stats.inQueue, hint: "open requests", icon: <Bell size={15} />, tone: "bg-accent-soft text-[#8a5209]" },
          { label: "On the waitlist", value: stats.waiting, hint: "over capacity", icon: <Clock size={15} />, tone: "bg-warn-soft text-warn" },
          { label: "Delivered this week", value: stats.deliveredThisWeek, hint: `${stats.delivered} all time`, icon: <Check size={15} />, tone: "bg-brand-soft text-brand" },
          { label: "Private open", value: stats.privateOpen, hint: `${formatNaira(stats.revenueKobo)} collected`, icon: <Lock size={15} />, tone: "bg-info-soft text-info" },
        ].map((stat) => (
          <div key={stat.label} className="surface p-4">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tone}`}>{stat.icon}</span>
            <p className="mt-2.5 font-display text-[26px] font-semibold leading-none">{stat.value}</p>
            <p className="mt-1 text-[12.5px] font-medium">{stat.label}</p>
            <p className="text-[11.5px] text-ink-3">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-2xl border border-line bg-card p-4">
          <CapacityForm capacity={String(stats.capacity)} queueSize={stats.inQueue} />
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Learner feedback</p>
          <p className="mt-1.5 text-[14px] font-medium">
            {feedback.total === 0
              ? "No feedback yet"
              : `${feedback.helpful}/${feedback.total} said the lesson solved it`}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {feedback.total === 0
              ? "Feedback appears here after lessons are watched."
              : "Useful signal for what to film next and what to fix."}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <QueueBoard items={items} notes={notes} />
      </div>

      <section className="mt-10 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Recent notifications sent</h2>
            <Link href="/admin/outbox" className="text-[13px] font-medium text-brand hover:underline">
              Open outbox
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {outbox.length === 0 && <li className="text-[13px] text-ink-3">Nothing sent yet.</li>}
            {outbox.map((email) => (
              <li key={email.id} className="rounded-lg border border-line bg-paper-2/40 px-3 py-2">
                <p className="truncate text-[13px] font-medium">{email.subject}</p>
                <p className="truncate text-[11.5px] text-ink-3">
                  to {email.toEmail} · {email.status}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-warn-soft/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-2">
            Email delivery is stubbed in this build: every message is captured in the outbox so the loop is testable
            end to end. Swapping in Resend/Postmark is one function.
          </p>
        </div>

        <div className="surface p-5">
          <h2 className="text-[15px] font-semibold">How publishing works here</h2>
          <ol className="mt-3 space-y-2.5">
            {[
              "Paste the YouTube link into the reply box. It is parsed and validated server-side.",
              "Publishing sets the request to Fulfilled and creates the public lesson page with Schema.org data.",
              "Everyone who asked or voted gets an in-app notification and an email in the outbox.",
              "The learner can mark it helpful — that feeds the dashboard above.",
            ].map((line, index) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">
                  {index + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="neutral">
              <Video size={11} /> YouTube for public
            </Badge>
            <Badge tone="neutral">
              <Lock size={11} /> Signed URLs for private
            </Badge>
            <Badge tone="neutral">
              <Sparkle size={11} /> {plural(stats.newThisWeek, "new request")} this week
            </Badge>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper-2/50 px-5 py-4">
        <p className="text-[13px] text-ink-2">
          Payments, entitlements and the notification log are wired. Switch modes, refund, inspect every email —{" "}
          <Link href="/admin/payments" className="font-medium text-brand hover:underline">
            payments
          </Link>{" "}
          ·{" "}
          <Link href="/admin/analytics" className="font-medium text-brand hover:underline">
            analytics
          </Link>
          .
        </p>
        <Link href="/admin/outbox" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
          Inspect the outbox <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
