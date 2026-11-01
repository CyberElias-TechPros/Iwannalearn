import Link from "next/link";
import { LessonPoster } from "@/components/lesson-poster";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "@/components/icons";
import { levelLabel, relativeTime } from "@/lib/status";
import type { LessonSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

export function LessonCard({
  lesson,
  className,
  showFromRequest = true,
}: {
  lesson: LessonSummary;
  className?: string;
  showFromRequest?: boolean;
}) {
  return (
    <article className={cn("surface group flex h-full flex-col overflow-hidden transition hover:shadow-lift", className)}>
      <Link href={`/tutorials/${lesson.slug}`} className="block" tabIndex={-1} aria-hidden="true">
        <LessonPoster category={lesson.category} length={lesson.videoLength} title={lesson.videoTitle ?? lesson.title} />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{lesson.category}</Badge>
          <span className="text-[12px] text-ink-3">{levelLabel(lesson.level)}</span>
        </div>

        <h3 className="text-[17.5px] font-semibold leading-snug">
          <Link href={`/tutorials/${lesson.slug}`} className="transition group-hover:text-brand">
            {lesson.videoTitle ?? lesson.title}
          </Link>
        </h3>

        {showFromRequest && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">
            Made for: <span className="italic">“{lesson.title}”</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12.5px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <Clock size={13} />
            {lesson.fulfilledAt ? relativeTime(lesson.fulfilledAt) : "Recently"}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-brand">
            Watch <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}
