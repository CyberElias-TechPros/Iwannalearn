import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listMyRequests, listUpvotedRequests } from "@/lib/queries";
import { LessonPoster } from "@/components/lesson-poster";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Bell, Book, Check, Clock, Plus, Sparkle, ThumbUp } from "@/components/icons";
import { OPEN_STATUSES, plural, relativeTime, statusMeta } from "@/lib/status";

export const metadata: Metadata = { title: "My learning" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const mine = listMyRequests(user.id);
  const backed = listUpvotedRequests(user.id);
  const ready = mine.filter((request) => request.status === "fulfilled");
  const needsPayment = mine.filter(
    (request) => request.paymentStatus === "pending" && (request.tier === "private" || request.tier === "priority"),
  );
  const needsConfirmation = mine.filter(
    (request) =>
      request.status === "fulfilled" &&
      (request.tier === "private" || request.tier === "priority") &&
      !request.deliveryConfirmedAt &&
      request.revisionState !== "closed",
  );
  const inProgress = mine.filter((request) => OPEN_STATUSES.includes(request.status as never));
  const closed = mine.filter((request) => request.status === "declined");

  return (
    <div className="wrap py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">My learning</p>
          <h1 className="mt-2 text-[clamp(1.8rem,3.6vw,2.5rem)] font-semibold leading-tight">
            Hi {user.name?.split(" ")[0] ?? "there"}.
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
            {ready.length > 0
              ? `${plural(ready.length, "lesson is", "lessons are")} ready for you. Everything else is moving along below.`
              : "Everything you've asked for lives here. We'll notify you the moment something changes."}
          </p>
        </div>
        <ButtonLink href="/requests/new">
          <Plus size={16} /> Ask for a lesson
        </ButtonLink>
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "Requests made", value: mine.length, icon: <Sparkle size={15} /> },
          { label: "Lessons ready", value: ready.length, icon: <Check size={15} /> },
          { label: "Votes given", value: backed.length, icon: <ThumbUp size={15} /> },
        ].map((stat) => (
          <div key={stat.label} className="surface flex items-center gap-3 p-4">
            <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand sm:flex">
              {stat.icon}
            </span>
            <div>
              <dt className="text-[12px] text-ink-3">{stat.label}</dt>
              <dd className="font-display text-[24px] font-semibold leading-tight">{stat.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {/* Ready */}
      {ready.length > 0 && (
        <section className="mt-10" aria-labelledby="ready-heading">
          <div className="flex items-center gap-2">
            <h2 id="ready-heading" className="text-[19px] font-semibold">
              Ready for you
            </h2>
            <Badge tone="success" dot>
              {ready.length} new
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ready.map((request) => {
              const isPrivate = request.visibility === "private";
              const href = isPrivate ? `/requests/${request.slug}` : `/tutorials/${request.slug}`;
              return (
              <article key={request.id} className="surface flex flex-col overflow-hidden sm:flex-row">
                <Link href={href} className="sm:w-40 sm:shrink-0" aria-label={request.lessonTitle ?? request.title}>
                  <LessonPoster category={request.category} length={request.videoLength} size="sm" className="h-full rounded-none sm:rounded-l-[1.25rem]" />
                </Link>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isPrivate ? "info" : "success"} dot>
                      {isPrivate ? "Private lesson" : "Lesson ready"}
                    </Badge>
                    {request.fulfilledAt && (
                      <span className="text-[11.5px] text-ink-3">{relativeTime(request.fulfilledAt)}</span>
                    )}
                  </div>
                  <h3 className="text-[16.5px] font-semibold leading-snug">
                    <Link href={href} className="hover:text-brand">
                      {request.lessonTitle ?? request.title}
                    </Link>
                  </h3>
                  <p className="line-clamp-1 text-[12.5px] text-ink-3">From: “{request.title}”</p>
                  <div className="mt-auto flex items-center gap-2 pt-1.5">
                    <ButtonLink href={href} size="sm">
                      {isPrivate ? "Open privately" : "Watch"} <ArrowRight size={14} />
                    </ButtonLink>
                    <Link href={`/requests/${request.slug}`} className="text-[12.5px] font-medium text-ink-2 hover:text-brand">
                      See the request
                    </Link>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Needs you */}
      {(needsPayment.length > 0 || needsConfirmation.length > 0) && (
        <section className="mt-8" aria-labelledby="needs-you-heading">
          <h2 id="needs-you-heading" className="flex items-center gap-2 text-[19px] font-semibold">
            <Bell size={17} className="text-accent" /> Waiting on you
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-3">
            Two small things you can only do yourself — pay, or confirm the work landed.
          </p>
          <ul className="mt-3 space-y-2">
            {needsPayment.map((request) => (
              <li key={`pay-${request.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{request.title}</p>
                  <p className="text-[12px] text-ink-3">
                    {request.tier === "private" ? "Private commission" : "Priority slot"} · payment pending
                  </p>
                </div>
                <ButtonLink href={`/requests/${request.slug}`} size="sm">
                  Complete payment <ArrowRight size={13} />
                </ButtonLink>
              </li>
            ))}
            {needsConfirmation.map((request) => (
              <li key={`confirm-${request.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-info/25 bg-info-soft/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{request.lessonTitle ?? request.title}</p>
                  <p className="text-[12px] text-ink-3">
                    Delivered {request.fulfilledAt ? relativeTime(request.fulfilledAt) : ""} · confirm or ask for one revision
                  </p>
                </div>
                <ButtonLink href={`/requests/${request.slug}`} size="sm" variant="secondary">
                  Review delivery <ArrowRight size={13} />
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* In progress */}
      <section className="mt-10" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-[19px] font-semibold">
          In the works
        </h2>
        <p className="mt-1 text-[13.5px] text-ink-3">Every stage is visible. No chasing required.</p>

        {inProgress.length === 0 && ready.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Sparkle size={20} />}
              title="Nothing requested yet"
              body="Pick the one thing you keep getting stuck on. A 30-second request is all it takes."
              action={
                <ButtonLink href="/requests/new">
                  <Plus size={16} /> Ask for your first lesson
                </ButtonLink>
              }
            />
          </div>
        ) : inProgress.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-paper-2/40 px-5 py-8 text-center">
            <p className="text-[14px] font-medium">All clear — nothing in production right now.</p>
            <p className="mt-1 text-[13px] text-ink-3">Got another gap? Ask, or back a request on the board.</p>
            <Link href="/explore?tab=requests" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline">
              Browse open requests <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {inProgress.map((request) => {
              const meta = statusMeta(request.status);
              return (
                <li key={request.id} className="surface p-4 transition hover:border-line-strong">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={request.status} />
                        <span className="text-[11.5px] text-ink-3">{request.ref}</span>
                        <span className="text-[11.5px] text-ink-3">· {request.category}</span>
                      </div>
                      <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug">
                        <Link href={`/requests/${request.slug}`} className="hover:text-brand">
                          {request.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">{meta.blurb}</p>
                    </div>
                    <Link
                      href={`/requests/${request.slug}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-brand/40 hover:text-brand"
                    >
                      Track <ArrowRight size={13} />
                    </Link>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${Math.max(12, (Math.min(meta.step, 5) / 5) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11.5px] text-ink-3">step {Math.min(meta.step, 5)} of 5</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Backed */}
      {backed.length > 0 && (
        <section className="mt-10" aria-labelledby="backed-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="backed-heading" className="text-[19px] font-semibold">
              Requests you&apos;ve backed
            </h2>
            <Link href="/explore?tab=requests" className="text-[13px] font-medium text-brand hover:underline">
              Find more
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {backed.map((request) => (
              <li key={request.id}>
                <Link href={`/requests/${request.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2/60">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{request.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3">
                      <ThumbUp size={12} /> {request.upvoteCount} waiting · {request.category}
                    </span>
                  </span>
                  <StatusPill status={request.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Closed */}
      {closed.length > 0 && (
        <section className="mt-10" aria-labelledby="closed-heading">
          <h2 id="closed-heading" className="text-[19px] font-semibold">
            Not going ahead
          </h2>
          <ul className="mt-3 space-y-2">
            {closed.map((request) => (
              <li key={request.id} className="rounded-xl border border-line bg-card px-4 py-3">
                <Link href={`/requests/${request.slug}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{request.title}</span>
                    <span className="text-[12px] text-ink-3">Declined — the reason is on the request</span>
                  </span>
                  <Badge tone="danger">Closed</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notification reassurance + creator shortcut */}
      <section className="mt-10 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <Bell size={16} className="text-brand" /> How you&apos;ll hear from us
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
            An email the moment a lesson is published, plus the bell in the top bar. If email ever fails, the bell
            still has you covered — the loop never depends on one channel.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <Book size={16} className="text-brand" /> A good request is specific
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
            “Merge two CSVs without losing headers” beats “Python” every single time. You can edit nothing after
            sending — just ask again if you want a sharper version.
          </p>
          <Link href="/how-it-works" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
            Tips for a great request <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-3">
        <Clock size={13} /> Signed in as {user.email}
      </p>
    </div>
  );
}
