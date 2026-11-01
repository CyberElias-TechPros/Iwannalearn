import Link from "next/link";
import { Sparkle } from "@/components/icons";
import { cn } from "@/lib/cn";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5 rounded-xl", className)}
      aria-label="iwannalearn — home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand text-white shadow-soft transition group-hover:bg-brand-strong">
        <Sparkle size={19} />
      </span>
      {!compact && (
        <span className="font-display text-[21px] font-semibold tracking-[-0.03em] text-ink">
          iwanna<span className="text-brand">learn</span>
        </span>
      )}
    </Link>
  );
}
