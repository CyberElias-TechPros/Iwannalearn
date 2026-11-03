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
  requestId,
  videoProvider,
}: {
  videoId: string | null;
  videoUrl: string | null;
  title: string;
  category: string;
  length?: string | null;
  requestId?: string;
  videoProvider?: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function playDirect() {
    if (!requestId) return;
    setLoading(true); setError(null);
    try { const response = await fetch(`/api/media/${encodeURIComponent(requestId)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Playback unavailable."); setSource(data.url); } catch (e) { setError(e instanceof Error ? e.message : "Playback unavailable."); } finally { setLoading(false); }
  }

  if (videoProvider === "direct") {
    return <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-ink/95 shadow-lift">
      {source ? <video src={source} title={title} controls playsInline className="absolute inset-0 h-full w-full" /> : <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-white"><Play size={24} /></div><p className="mt-4 font-display text-xl font-semibold text-white">{title}</p><button type="button" disabled={loading} onClick={() => void playDirect()} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Preparing…" : "Play lesson"}</button>{error && <p role="alert" className="mt-3 text-sm text-white">{error}</p>}</div></div>}
    </div>;
  }

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
