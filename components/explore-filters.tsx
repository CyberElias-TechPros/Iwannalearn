"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Close } from "@/components/icons";
import { CATEGORIES, LEVELS } from "@/lib/status";

export function ExploreFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");

  useEffect(() => {
    setTerm(params.get("q") ?? "");
  }, [params]);

  function push(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) query.delete(key);
      else query.set(key, value);
    });
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  }

  const hasFilters = Boolean(params.get("q") || params.get("category") || params.get("level"));

  return (
    <div className="surface p-3.5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <form
          className="flex flex-1 items-center gap-2 rounded-full border border-line bg-paper px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
          onSubmit={(event) => {
            event.preventDefault();
            push({ q: term.trim() || null });
          }}
          role="search"
        >
          <Search size={17} className="shrink-0 text-ink-3" />
          <label htmlFor="explore-q" className="sr-only">
            Search lessons and requests
          </label>
          <input
            id="explore-q"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search lessons and requests…"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
            autoComplete="off"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                push({ q: null });
              }}
              className="rounded-full p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"
              aria-label="Clear search"
            >
              <Close size={14} />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="filter-category" className="sr-only">
            Category
          </label>
          <select
            id="filter-category"
            value={params.get("category") ?? ""}
            onChange={(event) => push({ category: event.target.value || null })}
            className="h-10 rounded-full border border-line-strong bg-card px-3 text-[13.5px] text-ink-2"
          >
            <option value="">All topics</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <label htmlFor="filter-level" className="sr-only">
            Level
          </label>
          <select
            id="filter-level"
            value={params.get("level") ?? ""}
            onChange={(event) => push({ level: event.target.value || null })}
            className="h-10 rounded-full border border-line-strong bg-card px-3 text-[13.5px] text-ink-2"
          >
            <option value="">Any level</option>
            {Object.entries(LEVELS).map(([key, level]) => (
              <option key={key} value={key}>
                {level.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => push({ q: null, category: null, level: null })}
              className="h-10 rounded-full px-3 text-[13px] font-medium text-brand hover:bg-brand-soft"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 px-1 text-[12.5px] text-ink-3" aria-live="polite">
        {resultCount === 0 ? "No matches" : `${resultCount} ${resultCount === 1 ? "result" : "results"}`}
        {hasFilters ? " with these filters" : ""}
      </p>
    </div>
  );
}
