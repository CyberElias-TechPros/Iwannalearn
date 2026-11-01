import Link from "next/link";
import type { Metadata } from "next";
import { listTopics, topicCounts } from "@/lib/topics";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight, Plus, Sparkle } from "@/components/icons";

export const metadata: Metadata = {
  title: "Topics — every corner of iwannalearn",
  description: "Browse lessons and open requests by topic: spreadsheets, data, web development, AI tools, design and more.",
  alternates: { canonical: "/topics" },
};

export default function TopicsPage() {
  const topics = listTopics();
  const counts = topicCounts();

  return (
    <div className="wrap py-8 md:py-12">
      <header className="max-w-2xl">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">Topics</p>
        <h1 className="mt-2 text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-tight">
          Pick the thing you&apos;re stuck on.
        </h1>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">
          Every topic collects what has been filmed and what people are still waiting for. If your corner is empty, that
          isn&apos;t a dead end — it&apos;s the next request.
        </p>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => {
          const stat = counts[topic.category] ?? { lessons: 0, open: 0 };
          return (
            <Link
              key={topic.slug}
              href={`/topics/${topic.slug}`}
              className="group surface flex flex-col p-4 transition hover:border-brand/40 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-semibold leading-snug">{topic.title}</h2>
                <ArrowRight size={15} className="mt-0.5 shrink-0 text-ink-3 transition group-hover:text-brand" />
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{topic.blurb}</p>
              <p className="mt-auto pt-2.5 text-[11.5px] font-medium tabular-nums text-ink-2">
                {stat.lessons} lesson{stat.lessons === 1 ? "" : "s"} · {stat.open} waiting
              </p>
            </Link>
          );
        })}
      </div>

      <section className="mt-8 surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="flex items-center gap-1.5 text-[14.5px] font-semibold">
            <Sparkle size={16} className="text-brand" /> Not on the list?
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            “Other” is a real category here. Ask anyway — it gets read, and it gets filmed if enough people want it.
          </p>
        </div>
        <ButtonLink href="/requests/new">
          <Plus size={15} /> Ask for a lesson
        </ButtonLink>
      </section>
    </div>
  );
}
