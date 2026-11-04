"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminQueueItem } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { ReplyForm } from "@/components/admin/reply-form";
import { InternalNotes, StatusControl } from "@/components/admin/status-control";
import { ChevronDown, Clock, External, Link as LinkIcon, Lock, Search, ThumbUp } from "@/components/icons";
import { levelLabel, plural, relativeTime, tierMeta } from "@/lib/status";
import { cn } from "@/lib/cn";

type Note = { id: string; message: string; createdAt: string; authorName: string | null };

type FilterKey = "action" | "filming" | "private" | "delivered" | "all";

const FILTERS: { key: FilterKey; label: string; test: (item: AdminQueueItem) => boolean }[] = [
  { key: "action", label: "Needs a decision", test: (i) => ["submitted", "under_review"].includes(i.status) },
  { key: "filming", label: "In production", test: (i) => ["planned", "in_production"].includes(i.status) },
  { key: "private", label: "Private", test: (i) => i.tier === "private" },
  { key: "delivered", label: "Delivered", test: (i) => i.status === "fulfilled" },
  { key: "all", label: "Everything", test: () => true },
];

export function QueueBoard({
  items,
  notes,
}: {
  items: AdminQueueItem[];
  notes: Record<string, Note[]>;
}) {
  const [filter, setFilter] = useState<FilterKey>("action");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(
    items.find((item) => ["submitted", "under_review"].includes(item.status))?.id ?? null,
  );

  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)?.test ?? (() => true);
    const term = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        test(item) &&
        (!term ||
          item.title.toLowerCase().includes(term) ||
          item.ref.toLowerCase().includes(term) ||
          (item.ownerName ?? "").toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)),
    );
  }, [items, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Queue filters">
          {FILTERS.map((option) => {
            const count = items.filter(option.test).length;
            const active = filter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-card text-ink-2 hover:border-line-strong",
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-white/20" : "bg-paper-2 text-ink-3",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <Search size={15} className="text-ink-3" />
          <label htmlFor="queue-search" className="sr-only">
            Search the queue
          </label>
          <input
            id="queue-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, ref, person…"
            className="h-9 w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-ink-3 md:w-56"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-paper-2/40 px-6 py-10 text-center">
          <p className="text-[14px] font-medium">Nothing here right now.</p>
          <p className="mt-1 text-[13px] text-ink-3">
            That&apos;s a good sign. Switch filters to see the rest of the queue.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            const open = openId === item.id;
            const tier = tierMeta(item.tier);
            return (
              <li key={item.id} className={cn("surface overflow-hidden transition", open && "ring-1 ring-brand/20")}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-paper-2/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-3">{item.ref}</span>
                      <StatusPill status={item.status} />
                      {item.tier !== "community" && <Badge tone="accent">{tier.label}</Badge>}
                      {item.visibility === "private" && (
                        <Badge tone="neutral">
                          <Lock size={10} /> Private
                        </Badge>
                      )}
                      {item.priorityFlag === 1 && <Badge tone="warn">★ Pinned</Badge>}
                    </div>
                    <p className="mt-1.5 truncate text-[15px] font-semibold">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-ink-3">
                      <span>{item.ownerName ?? "Unknown"}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <ThumbUp size={11} /> {item.upvoteCount}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{levelLabel(item.level)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {plural(item.ageDays, "day")} old
                      </span>
                      {item.internalNoteCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{plural(item.internalNoteCount, "note")}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={cn("mt-1 shrink-0 text-ink-3 transition", open && "rotate-180")}
                  />
                </button>

                {open && (
                  <div className="border-t border-line bg-paper-2/20 p-4 md:p-5">
                    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                      <div className="space-y-4">
                        <div>
                          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">The outcome they want</p>
                          <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{item.goal}</p>
                        </div>

                        {item.tried && (
                          <div>
                            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Already tried</p>
                            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{item.tried}</p>
                          </div>
                        )}

                        {item.contextLink && (
                          <a
                            href={item.contextLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
                          >
                            <LinkIcon size={14} /> Attached context <External size={12} />
                          </a>
                        )}

                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-line bg-card p-3 text-[12.5px]">
                          <div>
                            <dt className="text-ink-3">Asked by</dt>
                            <dd className="font-medium">{item.ownerName}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">Email</dt>
                            <dd className="truncate font-medium">{item.ownerEmail ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">Topic</dt>
                            <dd className="font-medium">{item.category}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">Requested</dt>
                            <dd className="font-medium">{relativeTime(item.createdAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">Delivery</dt>
                            <dd className="font-medium">{tier.label}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-3">Payment</dt>
                            <dd className="font-medium text-warn">
                              {item.tier === "community" ? "Free tier" : "Not charged (Phase 7)"}
                            </dd>
                          </div>
                        </dl>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/requests/${item.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-brand/40 hover:text-brand"
                          >
                            Open request page <External size={12} />
                          </Link>
                          {item.hasLesson && (
                            <Link
                              href={`/tutorials/${item.slug}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-[12.5px] font-medium text-brand-strong hover:bg-brand-soft/70"
                            >
                              View published lesson <External size={12} />
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-line bg-card p-4">
                          <StatusControl requestId={item.id} status={item.status} priorityFlag={item.priorityFlag} />
                        </div>

                        <div className="rounded-xl border border-line bg-card p-4">
                          <ReplyForm requestId={item.id} hasLesson={item.hasLesson} isPrivate={item.visibility === "private"} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-line pt-4">
                      <InternalNotes requestId={item.id} notes={notes[item.id] ?? []} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
