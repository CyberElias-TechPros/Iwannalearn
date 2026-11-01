import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listLessons, listOpenRequests, countLessons, countOpenRequests } from "@/lib/queries";
import { getTopic, listTopics, topWanted, relatedTopicStats } from "@/lib/topics";
import { LessonCard } from "@/components/lesson-card";
import { RequestCard } from "@/components/request-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Plus, Search, Sparkle, ThumbUp } from "@/components/icons";

export const revalidate = 300;

export function generateStaticParams() {
  return listTopics().map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return { title: "Topic not found" };
  return {
    title: `${topic.title} — lessons and open requests`,
    description: topic.blurb,
    alternates: { canonical: `/topics/${topic.slug}` },
    openGraph: { title: `${topic.title} — iwannalearn`, description: topic.blurb },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const user = await getCurrentUser();
  const lessons = listLessons({ category: topic.category, limit: 9 });
  const openRequests = listOpenRequests({ viewerId: user?.id, category: topic.category, limit: 6 });
  const lessonCount = countLessons({ category: topic.category });
  const openCount = countOpenRequests({ category: topic.category });
  const wanted = topWanted(topic.category, 5);
  const totalEverAsked = relatedTopicStats(topic.category);

  const others = listTopics()
    .filter((item) => item.slug !== topic.slug)
    .slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${topic.title} lessons`,
    description: topic.blurb,
    hasPart: lessons.map((lesson) => ({
      "@type": "LearningResource",
      name: lesson.title,
      url: `/tutorials/${lesson.slug}`,
      learningResourceType: "Video",
    })),
  };

  return (
    <div className="wrap py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-3">
        <Link href="/topics" className="hover:text-brand">
          Topics
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-2">{topic.title}</span>
      </nav>

      <header className="mt-3 max-w-2xl">
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight">{topic.title}</h1>
        <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{topic.blurb}</p>
        <p className="mt-2 text-[12.5px] tabular-nums text-ink-3">
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"} · {openCount} open request{openCount === 1 ? "" : "s"} ·{" "}
          {totalEverAsked} asked in total
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/requests/new?category=${encodeURIComponent(topic.category)}`}>
            <Plus size={15} /> Ask about {topic.title.toLowerCase()}
          </ButtonLink>
          <ButtonLink href={`/explore?category=${encodeURIComponent(topic.category)}`} variant="secondary">
            See everything <ArrowRight size={15} />
          </ButtonLink>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Lessons here</h2>
        {lessons.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Search size={20} />}
              title="Nothing filmed in this topic yet"
              body="It's an open field. Ask, and what gets made is exactly what you needed — the first request in a topic usually gets filmed fast."
              action={
                <ButtonLink href={`/requests/new?category=${encodeURIComponent(topic.category)}`}>
                  <Sparkle size={15} /> Be the first to ask
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.requestId} lesson={lesson} />
            ))}
          </div>
        )}
      </section>

      {openRequests.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Being asked for</h2>
            <Link href={`/explore?tab=requests&category=${encodeURIComponent(topic.category)}`} className="text-[12.5px] font-medium text-brand hover:underline">
              All {openCount} open requests
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openRequests.map((request) => (
              <RequestCard key={request.id} request={request} signedIn={Boolean(user)} />
            ))}
          </div>
        </section>
      )}

      {wanted.length > 0 && (
        <section className="mt-8 surface p-5">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <ThumbUp size={15} className="text-brand" /> What this topic wants most
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Backing one is free and moves it up the queue.</p>
          <ol className="mt-2.5 space-y-1.5">
            {wanted.map((item, index) => (
              <li key={item.id}>
                <Link
                  href={`/requests/${item.slug}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/70 px-3 py-2 transition hover:border-brand/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-[12px] font-semibold tabular-nums text-ink-3">{index + 1}</span>
                    <span className="truncate text-[13px] font-medium">{item.title}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">{item.upvote_count} backers</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Other topics</h2>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {others.map((item) => (
            <Link
              key={item.slug}
              href={`/topics/${item.slug}`}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition hover:border-brand/40 hover:text-brand"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
