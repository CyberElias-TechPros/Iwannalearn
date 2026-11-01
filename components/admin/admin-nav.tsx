"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/library", label: "Library" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/outbox", label: "Outbox" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ badges }: { badges?: Record<string, number | undefined> }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-card p-1" aria-label="Creator studio">
      {links.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        const badge = badges?.[link.href];
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
              active ? "bg-brand text-white" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
            )}
          >
            {link.label}
            {badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-white/20" : "bg-accent-soft text-[#8a5209]",
                )}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
