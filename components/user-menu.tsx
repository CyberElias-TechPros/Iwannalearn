"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/actions";
import { Book, LogOut, Settings } from "@/components/icons";
import type { SessionUser } from "@/lib/types";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-card text-[12.5px] font-semibold text-ink transition hover:border-brand/40 hover:text-brand"
        aria-label="Your account"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initials(user.name, user.email)}
      </button>

      {open && (
        <div
          className="pop-in absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-card shadow-lift"
          role="menu"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[14px] font-semibold">{user.name ?? "Learner"}</p>
            <p className="truncate text-[12.5px] text-ink-3">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-ink-2 hover:bg-paper-2"
          >
            <Book size={16} /> My learning
          </Link>
          {user.role === "creator" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-ink-2 hover:bg-paper-2"
            >
              <Settings size={16} /> Creator studio
            </Link>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-[14px] text-ink-2 hover:bg-paper-2"
            >
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
