"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Compass, Home, Plus } from "@/components/icons";
import { cn } from "@/lib/cn";

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  const items = [
    { href: "/", label: "Home", icon: Home, match: "/" },
    { href: "/explore", label: "Explore", icon: Compass, match: "/explore" },
    { href: signedIn ? "/dashboard" : "/login", label: "Learning", icon: Book, match: "/dashboard" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <div className="relative mx-auto flex max-w-md items-stretch justify-between px-3">
        {items.slice(0, 2).map((item) => (
          <Tab key={item.label} {...item} active={pathname === item.match} />
        ))}

        <Link
          href="/requests/new"
          className="relative -top-4 flex h-14 w-14 shrink-0 flex-col items-center justify-center self-center rounded-full bg-brand text-white shadow-lift transition active:scale-95"
          aria-label="Ask for a lesson"
        >
          <Plus size={22} />
        </Link>

        {items.slice(2).map((item) => (
          <Tab key={item.label} {...item} active={pathname.startsWith(item.match) && item.match !== "/"} />
        ))}
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
        active ? "text-brand" : "text-ink-3",
      )}
    >
      <Icon size={21} />
      {label}
    </Link>
  );
}
