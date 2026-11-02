import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listLessons, listOpenRequests, publicStats } from "@/lib/queries";
import { HeroSearch } from "@/components/hero-search";
import { LessonCard } from "@/components/lesson-card";
import { RequestCard } from "@/components/request-card";
import { LessonPoster } from "@/components/lesson-poster";
import { StatusPill } from "@/components/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Bell,
  Check,
  Clock,
  Globe,
  Lock,
  PlayCircle,
  Sparkle,
  ThumbUp,
  Video,
} from "@/components/icons";
import { plural } from "@/lib/status";

export default async function HomePage() {
  const user = await getCurrentUser();
  const lessons = listLessons({ limit: 3 });
  const requests = listOpenRequests({ viewerId: user?.id, limit: 3 });
  const stats = publicStats();
  const featured = lessons[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-16rem] h-[26rem] w-[46rem] -translate-x-1/2 rounded-full bg-brand-soft/60 blur-3xl" />
          <div className="absolute right-[-10rem] top-24 h-64 w-64 rounded-full bg-accent-soft/70 blur-3xl" />
        </div>

        <div className="wrap grid gap-12 pb-16 pt-12 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <div className="rise-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1 text-[12.5px] font-medium text-ink-2">
              <Sparkle size={14} className="text-accent" />
              Request-driven learning · no endless searching
            </span>

            <h1 className="mt-5 text-[clamp(2.4rem,5.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
              Learn the exact thing
              <br className="hidden sm:block" /> you&apos;re{" "}
              <span className="relative whitespace-nowrap text-brand">
                stuck on
                <svg
                  className="absolute -bottom-2 left-0 w-full text-accent/70"
                  viewBox="0 0 200 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 8c40-6 90-7 196-4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
              Ask in plain words — “merge two CSVs in pandas without losing headers”, “a flyer that prints
              properly on A5”. We&apos;ll find a lesson that already answers it, or make one for your exact
              situation and <strong className="font-semibold text-ink">ping you the moment it&apos;s ready</strong>.
            </p>

            <div className="mt-7">
              <HeroSearch />
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-brand" /> Free to ask
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-brand" /> Browse without an account
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-brand" /> No sales calls
              </span>
            </p>
          </div>

          {/* Preview card */}
          <div className="rise-in hidden lg:block" style={{ animationDelay: "120ms" }}>
            {featured ? (
              <div className="relative">
                <div className="surface overflow-hidden">
                  <LessonPoster category={featured.category} length={featured.videoLength} title={featured.videoTitle ?? featured.title} />
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-2">
                      <Badge tone="success" dot>
                        Lesson ready
                      </Badge>
                      <span className="text-[12px] text-ink-3">made this week</span>
                    </div>
                    <h2 className="text-[21px] font-semibold leading-snug">
                      {featured.videoTitle ?? featured.title}
                    </h2>
                    <p className="text-[13.5px] leading-relaxed text-ink-3">
                      Requested by {featured.ownerName ?? "a learner"} · {plural(featured.upvoteCount, "person", "people")} waiting
                    </p>
                    <div className="flex items-center justify-between border-t border-line/70 pt-3 text-[13px]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-brand">
                        <PlayCircle size={16} /> Watch the lesson
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-ink-3">
                        <Bell size={14} /> Notified when it dropped
                      </span>
                    </div>
                  </div>
                </div>

                <div className="surface absolute -bottom-6 -left-6 w-64 p-4 shadow-lift">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Your request</p>
                  <p className="mt-1 text-[13.5px] font-medium leading-snug">
                    Merge two CSVs without losing headers
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusPill status="in_production" />
                    <span className="text-[11.5px] text-ink-3">filmed today</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2">
                    <div className="h-full w-4/5 rounded-full bg-brand" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="wrap">
          <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-card/70 px-4 py-4 text-center md:gap-6 md:px-8">
            {[
              { label: "Lessons ready", value: stats.lessons },
              { label: "Requests in the queue", value: stats.open },
              { label: "Learners here", value: stats.learners },
            ].map((item) => (
              <div key={item.label} className="flex flex-col">
                <dt className="order-2 text-[12px] text-ink-3 md:text-[13px]">{item.label}</dt>
                <dd className="font-display text-[26px] font-semibold text-ink md:text-[30px]">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section className="wrap mt-20 md:mt-24" aria-labelledby="how-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
            <h2 id="how-heading" className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold">
              Three steps. No gatekeeping.
            </h2>
          </div>
          <Link href="/how-it-works" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand hover:underline">
            The full picture <ArrowRight size={15} />
          </Link>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <Sparkle size={20} />,
              title: "Describe it like you'd tell a friend",
              body: "A 30-second form with prompts that make vague asks specific — what you want to do, your level, what you've tried.",
              note: "Takes about 30 seconds",
            },
            {
              icon: <Globe size={20} />,
              title: "We check what already exists",
              body: "If a lesson covers it, you watch it now. If someone already asked, add your vote instead of starting over.",
              note: "No duplicate requests",
            },
            {
              icon: <Video size={20} />,
              title: "A video for your situation",
              body: "Short, focused, and made against your actual goal — with links, notes and a way to say whether it helped.",
              note: "You get notified, never chased",
            },
          ].map((step, index) => (
            <li key={step.title} className="surface flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {step.icon}
                </span>
                <span className="font-display text-[28px] font-semibold text-line-strong">{index + 1}</span>
              </div>
              <h3 className="text-[17.5px] font-semibold leading-snug">{step.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-3">{step.body}</p>
              <p className="mt-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
                <Check size={14} className="text-brand" /> {step.note}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Ready to watch */}
      {lessons.length > 0 && (
        <section className="wrap mt-20" aria-labelledby="ready-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Ready right now</p>
              <h2 id="ready-heading" className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold">
                Lessons built from real requests
              </h2>
            </div>
            <ButtonLink href="/explore" variant="secondary" size="sm">
              Browse the library <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.requestId} lesson={lesson} />
            ))}
          </div>
        </section>
      )}

      {/* Most wanted */}
      {requests.length > 0 && (
        <section className="wrap mt-20" aria-labelledby="wanted-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Most wanted</p>
              <h2 id="wanted-heading" className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold">
                What people are asking for
              </h2>
              <p className="mt-2 max-w-xl text-[14.5px] text-ink-3">
                Voting isn&apos;t a survey — it decides what gets filmed next. One vote is enough.
              </p>
            </div>
            <ButtonLink href="/explore?tab=requests" variant="secondary" size="sm">
              See all requests <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} signedIn={Boolean(user)} />
            ))}
          </div>
        </section>
      )}

      {/* Tiers */}
      <section className="wrap mt-20" aria-labelledby="tiers-heading">
        <div className="surface overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[1.1fr_1fr_1fr]">
            <div className="bg-brand p-7 text-white md:p-8">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Three ways to learn</p>
              <h2 id="tiers-heading" className="mt-2 text-[26px] font-semibold leading-tight">
                Everyone gets the free one. Pay only for speed or privacy.
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-white/80">
                No subscription. No locked library. If a lesson exists, you watch it — that&apos;s the whole point.
              </p>
              <Link
                href="/how-it-works#private"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-white/25"
              >
                How private lessons work <ArrowRight size={15} />
              </Link>
            </div>

            {[
              {
                icon: <ThumbUp size={18} />,
                title: "Community",
                price: "Free",
                body: "Ask, vote, learn. The lesson is public and stays in the library for everyone after you.",
                highlight: true,
              },
              {
                icon: <Clock size={18} />,
                title: "Priority",
                price: "₦4,000",
                body: "Same public lesson, filmed next. You're buying a place in the calendar, not secrecy.",
                highlight: false,
              },
              {
                icon: <Lock size={18} />,
                title: "Private",
                price: "From ₦25,000",
                body: "A walkthrough of your own files or project. Never published, never indexed, yours alone.",
                highlight: false,
              },
            ].map((tier) => (
              <div key={tier.title} className="border-t border-line p-6 md:border-l md:border-t-0 md:p-7">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-2 text-ink-2">{tier.icon}</span>
                <div className="mt-3 flex items-baseline gap-2">
                  <h3 className="text-[17px] font-semibold">{tier.title}</h3>
                  {tier.highlight && <Badge tone="success">Start here</Badge>}
                </div>
                <p className="font-display text-[22px] font-semibold text-ink">{tier.price}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{tier.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo note + final CTA */}
      <section className="wrap mt-20">
        <div className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
          <div className="surface flex flex-col justify-between gap-4 bg-paper-2/60 p-7">
            <div>
              <h2 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold">
                Stuck on something small? That&apos;s exactly the point.
              </h2>
              <p className="mt-2 max-w-lg text-[14.5px] leading-relaxed text-ink-2">
                You don&apos;t need a 10-hour course. You need the one missing step, explained once, properly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink href="/requests/new">
                Ask for a lesson <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="/explore" variant="secondary">
                Browse what&apos;s ready
              </ButtonLink>
            </div>
          </div>

          <div className="surface p-7">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-accent">Try both sides</p>
            <h3 className="mt-2 text-[20px] font-semibold">This is a working demo</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
              Sign in as a learner to file a request, or as the creator to publish a lesson and watch the
              notification land. No password needed.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink href="/login?as=learner" variant="secondary" size="sm" className="justify-between">
                Enter as a learner <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href="/login?as=creator" variant="ghost" size="sm" className="justify-between border border-line">
                Enter as the creator <ArrowRight size={15} />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
