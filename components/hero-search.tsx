"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, PlayCircle, Plus, Search, Spinner, ThumbUp } from "@/components/icons";
import { cn } from "@/lib/cn";

type Results = {
  lessons: { slug: string; title: string; category: string; length: string | null }[];
  requests: { slug: string; title: string; category: string; upvotes: number }[];
};

const SUGGESTIONS = [
  "merge CSVs in pandas",
  "Canva flyer",
  "SQL joins",
  "npm permission error",
  "edit reels on my phone",
];

export function HeroSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as Results;
        setResults(data);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults(null);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        document.getElementById("hero-search-input")?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const hasResults = Boolean(results && (results.lessons.length > 0 || results.requests.length > 0));
  const showPanel = open && value.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          setOpen(false);
          router.push(`/explore?q=${encodeURIComponent(value.trim())}`);
        }}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card p-1.5 pl-4 shadow-soft transition",
          "border-line-strong focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15",
        )}
      >
        <Search size={20} className="shrink-0 text-ink-3" />
        <label htmlFor="hero-search-input" className="sr-only">
          Search lessons and requests
        </label>
        <input
          id="hero-search-input"
          type="search"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => value.trim().length >= 2 && setOpen(true)}
          placeholder="What do you want to learn? Try “merge CSVs in pandas”"
          autoComplete="off"
          aria-expanded={showPanel}
          aria-controls="hero-search-results"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-ink-3/80 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          className="hidden h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-[14.5px] font-medium text-white transition hover:bg-brand-strong sm:inline-flex"
        >
          Search
        </button>
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white sm:hidden"
          aria-label="Search"
        >
          <ArrowRight size={18} />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-3">Popular:</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setValue(suggestion);
              document.getElementById("hero-search-input")?.focus();
            }}
            className="rounded-full border border-line bg-card/70 px-2.5 py-1 text-ink-2 transition hover:border-brand/40 hover:text-brand"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {showPanel && (
        <div
          id="hero-search-results"
          className="pop-in absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-line bg-card shadow-lift"
        >
          {loading && !results ? (
            <div className="flex items-center gap-2 px-4 py-4 text-[13.5px] text-ink-3">
              <Spinner size={16} /> Searching the library…
            </div>
          ) : hasResults ? (
            <div className="max-h-[60vh] overflow-y-auto py-1.5">
              {results!.lessons.length > 0 && (
                <div className="px-2 py-1">
                  <p className="px-2 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                    Ready to watch
                  </p>
                  {results!.lessons.map((lesson) => (
                    <Link
                      key={lesson.slug}
                      href={`/tutorials/${lesson.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-paper-2/70"
                    >
                      <PlayCircle size={18} className="mt-0.5 shrink-0 text-brand" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{lesson.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {lesson.category}
                          {lesson.length ? ` · ${lesson.length}` : ""}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {results!.requests.length > 0 && (
                <div className="border-t border-line/70 px-2 py-1">
                  <p className="px-2 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                    Already requested
                  </p>
                  {results!.requests.map((request) => (
                    <Link
                      key={request.slug}
                      href={`/requests/${request.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-paper-2/70"
                    >
                      <ThumbUp size={17} className="mt-0.5 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{request.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {request.category} · {request.upvotes} waiting
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                href={`/explore?q=${encodeURIComponent(value.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-[13px] font-medium text-brand hover:bg-paper-2/60"
              >
                See all results <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-[14px] font-medium">Nothing matches “{value.trim()}” yet.</p>
              <p className="mt-0.5 text-[13px] text-ink-3">That&apos;s a gap worth filling — ask for it in 30 seconds.</p>
              <Link
                href={`/requests/new?title=${encodeURIComponent(value.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-strong"
              >
                <Plus size={14} /> Ask for this lesson
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
