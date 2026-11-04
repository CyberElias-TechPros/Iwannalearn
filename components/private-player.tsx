"use client";

import { useState } from "react";
import { Lock, Play, Refresh } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function PrivatePlayer({ videoId, title, requestId }: { videoId: string | null; title: string; requestId: string }) {
  const [playing, setPlaying] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legacyYoutube = Boolean(videoId);

  async function start() {
    if (legacyYoutube) { setPlaying(true); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/media/${encodeURIComponent(requestId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Playback is unavailable.");
      setSource(data.url); setPlaying(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Playback is unavailable."); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative aspect-video w-full">
      {playing ? (
        source ? <video src={source} title={title} controls playsInline controlsList="nodownload" className="absolute inset-0 h-full w-full bg-black" /> : <iframe key={nonce} src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&playsinline=1`} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink to-ink/80 p-6 text-center">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-white"><Lock size={24} /></div>
            <p className="mt-4 font-display text-xl font-semibold text-white">{title}</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/70">{legacyYoutube ? "Legacy private YouTube delivery. New private lessons use protected direct media and the native app." : "A private lesson made for you. Playback is checked against your account and the signed link expires."}</p>
            <Button className="mt-5" onClick={() => void start()} disabled={loading}><Play size={16} /> {loading ? "Checking access…" : "Play private video"}</Button>
            {error && <p role="alert" className="mt-3 text-sm text-white">{error}</p>}
          </div>
        </div>
      )}
      {playing && <button type="button" onClick={() => { setPlaying(false); setSource(null); setNonce((n) => n + 1); }} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/80"><Refresh size={12} /> Reset playback</button>}
    </div>
  );
}
