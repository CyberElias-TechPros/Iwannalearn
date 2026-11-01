"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Check, Inbox } from "@/components/icons";
import { markNotificationsReadAction } from "@/lib/actions";
import { relativeTime } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { NotificationRow } from "@/lib/types";

export function NotificationBell({ items, unread }: { items: NotificationRow[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-paper-2 hover:text-ink"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="pop-in absolute right-0 top-12 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-lift"
          role="menu"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[14px] font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(async () => { await markNotificationsReadAction(); })}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
              >
                <Check size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Inbox size={22} className="text-ink-3" />
                <p className="text-[14px] font-medium">Nothing yet</p>
                <p className="text-[13px] text-ink-3">
                  We&apos;ll ping you here the moment your lesson moves forward.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "/dashboard"}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block border-b border-line/70 px-4 py-3 transition last:border-0 hover:bg-paper-2/60",
                    !item.readAt && "bg-brand-tint/60",
                  )}
                  role="menuitem"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        item.readAt ? "bg-transparent" : "bg-brand",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{item.body}</p>
                      <p className="mt-1 text-[11.5px] text-ink-3/80">{relativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block border-t border-line bg-paper-2/40 px-4 py-2.5 text-center text-[13px] font-medium text-brand hover:bg-paper-2"
          >
            Go to my learning
          </Link>
        </div>
      )}
    </div>
  );
}
