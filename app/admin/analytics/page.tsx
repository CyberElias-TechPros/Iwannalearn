import Link from "next/link";
import type { Metadata } from "next";
import { analyticsSnapshot, creatorDigestData, getFeedbackSummary, listRecentFeedback, publicStats } from "@/lib/queries";
import { DigestButton } from "@/components/admin/email-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Chart, Check, Sparkle } from "@/components/icons";

export const metadata: Metadata = { title: "Analytics — creator studio" };

export default async function AdminAnalyticsPage() {
  const snap = analyticsSnapshot();
  const feedback = getFeedbackSummary();
  const recent = listRecentFeedback();
  const digest = creatorDigestData();
  const stats = publicStats();

  const maxDaily = Math.max(1, ...snap.daily.map((day) => Math.max(day.requests, day.lessons)));

  const funnel = [
    { label: "Searches", value: snap.funnel.searches, hint: `${snap.funnel.zeroResultSearches} found nothing` },
    { label: "Requests filed", value: snap.funnel.requestsSubmitted, hint: `vs ${snap.funnel.requestsPreviousWeek} last week` },
    { label: "Lessons delivered", value: snap.funnel.lessonsDelivered, hint: "this week" },
    { label: "Lessons watched", value: snap.funnel.lessonsWatched, hint: "play events" },
    { label: "Feedback given", value: snap.funnel.feedbackGiven, hint: `${snap.funnel.votesCast} votes cast` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Median days to delivery", value: snap.medianDaysToDelivery ?? "—", hint: "request → lesson" },
          { label: "Helpfulness", value: snap.helpfulness === null ? "—" : `${snap.helpfulness}%`, hint: `${feedback.helpful}/${feedback.total} said it helped` },
          { label: "Returning learners", value: snap.returningUsers, hint: `of ${snap.activeUsers} active this week` },
          { label: "Library", value: stats.lessons, hint: `${stats.open} open requests` },
        ].map((card) => (
          <div key={card.label} className="surface p-4">
            <p className="text-[11.5px] uppercase tracking-wide text-ink-3">{card.label}</p>
            <p className="font-display text-[22px] font-semibold leading-tight">{card.value}</p>
            <p className="text-[11.5px] text-ink-3">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="surface p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Chart size={15} className="text-brand" /> Last 14 days
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">Bars: requests filed. Dots: lessons played.</p>
          </div>
          <DigestButton />
        </div>

        <div className="mt-4 flex items-end gap-1.5" role="img" aria-label="Requests and lesson plays over the last fourteen days">
          {snap.daily.map((day) => {
            const height = Math.round((day.requests / maxDaily) * 100);
            const lessonHeight = Math.round((day.lessons / maxDaily) * 100);
            return (
              <div key={day.day} className="group relative flex-1">
                <div className="flex h-24 items-end gap-0.5">
                  <div
                    className="flex-1 rounded-t bg-brand/75"
                    style={{ height: `${Math.max(3, height)}%` }}
                    title={`${day.requests} requests`}
                  />
                  <div
                    className="flex-1 rounded-t bg-accent/70"
                    style={{ height: `${Math.max(3, lessonHeight)}%` }}
                    title={`${day.lessons} plays`}
                  />
                </div>
                <p className="mt-1 text-center text-[9.5px] text-ink-3">{day.day.slice(8)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-4 md:p-5">
          <h2 className="text-[15px] font-semibold">The loop, this week</h2>
          <ul className="mt-2.5 space-y-2">
            {funnel.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2/50 px-3 py-2">
                <div>
                  <p className="text-[13px] font-medium">{step.label}</p>
                  <p className="text-[11.5px] text-ink-3">{step.hint}</p>
                </div>
                <p className="font-display text-[18px] font-semibold tabular-nums">{step.value}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            Target: ≥70% of requests fulfilled, ≥80% helpfulness, ≥20% of learners returning within 7 days. Those
            thresholds gate charging money — see the plan&apos;s G2.
          </p>
        </section>

        <section className="surface p-4 md:p-5">
          <h2 className="text-[15px] font-semibold">What people search for</h2>
          {snap.topSearches.length === 0 && snap.gaps.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-3">No searches logged yet — search terms appear here as people use the site.</p>
          ) : (
            <>
              <ul className="mt-2.5 space-y-1.5">
                {snap.topSearches.map((term) => (
                  <li key={term.term} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="truncate">“{term.term}”</span>
                    <span className="shrink-0 tabular-nums text-ink-3">
                      {term.count} {term.missed > 0 ? <span className="text-warn">· {term.missed} empty</span> : null}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Demand gaps</h3>
              <p className="mt-0.5 text-[11.5px] text-ink-3">Searches that returned nothing. Each one is a lesson nobody has asked for yet.</p>
              {snap.gaps.length === 0 ? (
                <p className="mt-1.5 text-[12.5px] text-brand">Nothing empty this week — the library is keeping up.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {snap.gaps.map((gap) => (
                    <li key={gap.term} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate">“{gap.term}”</span>
                      <Link
                        href={`/requests/new?title=${encodeURIComponent(gap.term)}`}
                        className="shrink-0 text-[11.5px] font-medium text-brand hover:underline"
                      >
                        File it <ArrowRight size={11} className="inline" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <section className="surface p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Recent feedback</h2>
          <Badge tone={feedback.total === 0 ? "neutral" : "success"}>
            {feedback.helpful}/{feedback.total} helpful
          </Badge>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<Sparkle size={20} />}
            title="No feedback yet"
            body="Learners see a two-tap prompt on every answer. It's the cheapest signal you'll get — and the one that should decide what you film next."
          />
        ) : (
          <ul className="mt-2.5 space-y-2">
            {recent.map((item, index) => (
              <li key={index} className="rounded-lg border border-line bg-paper-2/40 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  {item.helpful ? (
                    <Check size={13} className="text-brand" />
                  ) : (
                    <span className="text-warn">×</span>
                  )}
                  {item.learner ?? "A learner"} on {item.title}
                </p>
                {item.comment && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{item.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface p-4 md:p-5">
        <h2 className="text-[15px] font-semibold">Weekly digest preview</h2>
        <p className="mt-0.5 text-[12px] text-ink-3">What lands in your inbox on {new Date().toLocaleDateString("en-GB", { weekday: "long" })}s.</p>
        <dl className="mt-2.5 grid gap-2 text-[12.5px] sm:grid-cols-2">
          <div className="rounded-lg bg-paper-2/50 px-3 py-2">
            <dt className="text-ink-3">New requests</dt>
            <dd className="font-semibold">{digest.newRequests}</dd>
          </div>
          <div className="rounded-lg bg-paper-2/50 px-3 py-2">
            <dt className="text-ink-3">Top voted</dt>
            <dd className="truncate font-semibold">{digest.topVoted}</dd>
          </div>
          <div className="rounded-lg bg-paper-2/50 px-3 py-2">
            <dt className="text-ink-3">Delivered this week</dt>
            <dd className="font-semibold">{digest.delivered}</dd>
          </div>
          <div className="rounded-lg bg-paper-2/50 px-3 py-2">
            <dt className="text-ink-3">Waiting on you</dt>
            <dd className="font-semibold">{digest.queue}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
