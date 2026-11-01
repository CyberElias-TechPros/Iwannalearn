import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { listLessons, listOpenRequests } from "@/lib/queries";
import { ExploreFilters } from "@/components/explore-filters";
import { LessonCard } from "@/components/lesson-card";
import { RequestCard } from "@/components/request-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Plus, Search, Sparkle, ThumbUp } from "@/components/icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Explore",
  description: "Lessons that already answer your question, and requests you can back to get filmed next.",
};

type Search = {
  tab?: string;
  q?: string;
  category?: string;
  level?: string;
  sort?: string;
};

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const tab = params.tab === "requests" ? "requests" : "lessons";

  const lessons =
    tab === "lessons"
      ? listLessons({ q: params.q, category: params.category, level: params.level, limit: 48 })
      : [];
  const requests =
    tab === "requests"
      ? listOpenRequests({ viewerId: user?.id, q: params.q, category: params.category, level: params.level, limit: 48 })
      : [];

  const count = tab === "lessons" ? lessons.length : requests.length;
  const tabHref = (nextTab: string) => {
    const query = new URLSearchParams();
    if (nextTab !== "lessons") query.set("tab", nextTab);
    if (params.q) query.set("q", params.q);
    if (params.category) query.set("category", params.category);
    if (params.level) query.set("level", params.level);
    const qs = query.toString();
    return `/explore${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="wrap py-8 md:py-12">
      <header className="max-w-2xl">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Explore</p>
        <h1 className="mt-2 text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-tight">
          Find your answer. Or ask for it.
        </h1>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">
          {tab === "lessons"
            ? "Every lesson here started as someone's real request. Watch what exists — no account needed."
            : "These are the requests in the queue. Backing one is how it gets filmed sooner."}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav
          className="inline-flex rounded-full border border-line bg-card p-1"
          aria-label="Explore sections"
        >
          <Link
            href={tabHref("lessons")}
            aria-current={tab === "lessons" ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-[13.5px] font-medium transition",
              tab === "lessons" ? "bg-brand text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            Ready to watch
          </Link>
          <Link
            href={tabHref("requests")}
            aria-current={tab === "requests" ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-[13.5px] font-medium transition",
              tab === "requests" ? "bg-brand text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            Open requests
          </Link>
        </nav>

        <ButtonLink href="/requests/new" size="sm">
          <Plus size={15} /> Ask for a lesson
        </ButtonLink>
      </div>

      <div className="mt-4">
        <Suspense fallback={<div className="surface h-[104px]" />}>
          <ExploreFilters resultCount={count} />
        </Suspense>
      </div>

      <div className="mt-6">
        {tab === "lessons" ? (
          lessons.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((lesson) => (
                <LessonCard key={lesson.requestId} lesson={lesson} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search size={20} />}
              title="No lesson covers this yet"
              body="That's not a dead end — it's a request waiting to happen. Ask, and you'll be the first to get it."
              action={
                <ButtonLink href={`/requests/new${params.q ? `?title=${encodeURIComponent(params.q)}` : ""}`}>
                  <Sparkle size={15} /> Ask for this lesson
                </ButtonLink>
              }
            />
          )
        ) : requests.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} signedIn={Boolean(user)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ThumbUp size={20} />}
            title="Nothing in the queue matches that"
            body="Start a new request — or clear the filters to see what everyone else is asking for."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={`/requests/new${params.q ? `?title=${encodeURIComponent(params.q)}` : ""}`}>
                  <Plus size={15} /> Ask for a lesson
                </ButtonLink>
                <ButtonLink href="/explore?tab=requests" variant="secondary">
                  Clear filters
                </ButtonLink>
              </div>
            }
          />
        )}
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-3">
        Can&apos;t find it?{" "}
        <Link href="/requests/new" className="font-medium text-brand underline-offset-2 hover:underline">
          Ask for it
        </Link>{" "}
        — that&apos;s the whole point of this place.
      </p>
    </div>
  );
}
