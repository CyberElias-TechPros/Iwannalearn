"use client";

import { useState } from "react";
import { Play } from "@/components/icons";
import { trackLessonPlayedAction } from "@/lib/actions";

/**
 * Private player. Deliberately minimal: no share button, no "watch on YouTube",
 * no related videos — all three leak private content by design elsewhere.
 */
export function PrivatePlayer({ videoId, title, requestId }: { videoId: string; title: string; requestId: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            void trackLessonPlayedAction(requestId);
          }}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-ink to-[#0b1410] text-center"
          aria-label={`Play private lesson: ${title}`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-brand shadow-lift transition group-hover:scale-105">
            <Play size={26} />
          </span>
          <span className="max-w-sm px-6 text-[13.5px] font-medium text-white/90">{title}</span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Private · signed link</span>
        </button>
      )}
    </div>
  );
}
