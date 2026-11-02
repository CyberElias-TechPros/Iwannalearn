"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/explore", label: "Explore", match: ["/explore", "/tutorials", "/requests"] },
  { href: "/topics", label: "Topics", match: ["/topics"] },
  { href: "/how-it-works", label: "How it works", match: ["/how-it-works"] },
  { href: "/pricing", label: "Pricing", match: ["/pricing"] },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {links.map((link) => {
        const active = link.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-2 text-[14.5px] font-medium transition",
              active ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2/70 hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
      {signedIn && (
        <Link
          href="/dashboard"
          aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-2 text-[14.5px] font-medium transition",
            pathname.startsWith("/dashboard")
              ? "bg-paper-2 text-ink"
              : "text-ink-2 hover:bg-paper-2/70 hover:text-ink",
          )}
        >
          My learning
        </Link>
      )}
    </nav>
  );
}
