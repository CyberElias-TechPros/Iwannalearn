import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "paper",
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "paper" | "card";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center",
        tone === "paper" ? "border-line-strong bg-paper-2/40" : "border-line-strong bg-card",
        className,
      )}
    >
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="text-[19px] font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-sm text-[14.5px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
