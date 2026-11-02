import Link from "next/link";
import type { Metadata } from "next";
import { adminQueue, libraryStats, searchLibrary } from "@/lib/queries";
import { ReuseForm } from "@/components/admin/reuse-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Book, ArrowRight, Refresh } from "@/components/icons";

export const metadata: Metadata = { title: "Library — creator studio" };

export default async function AdminLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const lessons = searchLibrary(q ?? "", 30);
  const stats = libraryStats();
  const openRequests = adminQueue()
    .filter((request) => !["fulfilled", "declined"].includes(request.status))
    .map((request) => ({
      id: request.id,
      ref: request.ref,
      title: request.title,
      category: request.category,
    }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Lessons filmed", value: stats.lessons, hint: "reusable forever" },
          { label: "Reused", value: stats.reuses, hint: "filmed once, sent again" },
          { label: "Topics", value: stats.categories, hint: stats.mostReused?.title ? `top: ${stats.mostReused.title.slice(0, 24)}…` : "—" },
        ].map((card) => (
          <div key={card.label} className="surface p-4">
            <p className="text-[11.5px] uppercase tracking-wide text-ink-3">{card.label}</p>
            <p className="font-display text-[22px] font-semibold leading-tight">{card.value}</p>
            <p className="truncate text-[11.5px] text-ink-3">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Book size={15} className="text-brand" /> Search what you&apos;ve already filmed
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">
              Before opening OBS, check here. Reusing a lesson answers the same question in seconds and keeps the
              library small enough to stay useful.
            </p>
          </div>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search lesson titles…"
              className="h-9 w-56 rounded-lg border border-line-strong bg-card px-3 text-[13px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
            />
            <button type="submit" className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white">
              Search
            </button>
          </form>
        </div>
      </section>

      {lessons.length === 0 ? (
        <EmptyState
          icon={<Refresh size={20} />}
          title={q ? `Nothing matched “${q}”` : "No filmed lessons yet"}
          body="Once you publish your first lesson it appears here, with a shortcut to send it to any open request."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {lessons.map((lesson) => (
            <li key={lesson.requestId} className="surface flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{lesson.videoTitle ?? lesson.title}</p>
                  <p className="truncate text-[11.5px] text-ink-3">
                    {lesson.category} · answered “{lesson.title}”
                  </p>
                </div>
                <Badge tone={lesson.visibility === "private" ? "info" : "neutral"}>
                  {lesson.visibility === "private" ? "private" : "public"}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
                <Link href={`/tutorials/${lesson.slug}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  View lesson <ArrowRight size={11} />
                </Link>
                <span>·</span>
                <span>{lesson.reuseCount > 0 ? `reused ${lesson.reuseCount}×` : "not reused yet"}</span>
                {lesson.videoLength && (
                  <>
                    <span>·</span>
                    <span>{lesson.videoLength}</span>
                  </>
                )}
              </div>

              <div className="mt-3 border-t border-line/70 pt-2.5">
                <ReuseForm
                  lesson={{
                    requestId: lesson.requestId,
                    slug: lesson.slug,
                    videoTitle: lesson.videoTitle,
                    replyId: lesson.replyId,
                    category: lesson.category,
                    reuseCount: Number(lesson.reuseCount ?? 0),
                  }}
                  requests={openRequests}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
