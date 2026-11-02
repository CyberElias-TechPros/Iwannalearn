"use client";

import { useState } from "react";
import { External, Play } from "@/components/icons";
import { LessonPoster } from "@/components/lesson-poster";

export function LessonPlayer({
  videoId,
  videoUrl,
  title,
  category,
  length,
}: {
  videoId: string | null;
  videoUrl: string | null;
  title: string;
  category: string;
  length?: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  if (!videoId) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line">
        <LessonPoster category={category} length={length} title={title} size="lg" showPlay={false} />
        <p className="bg-card px-4 py-3 text-[13px] text-ink-3">This lesson has no video attached yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-line bg-ink">
        {playing ? (
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block w-full text-left"
            aria-label={`Play lesson: ${title}`}
          >
            <LessonPoster category={category} length={length} title={title} size="lg" showPlay={false} />
            <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/10">
              <span className="flex items-center gap-2 rounded-full bg-white/95 px-5 py-3 text-[14px] font-semibold text-ink shadow-lift transition group-hover:scale-[1.03]">
                <Play size={16} className="text-brand" /> Play lesson
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span>Plays in-page. Nothing loads until you press play.</span>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
          >
            Open on YouTube <External size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
