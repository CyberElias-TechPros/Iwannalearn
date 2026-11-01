"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ThumbUp } from "@/components/icons";
import { toggleUpvoteAction } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function UpvoteButton({
  requestId,
  initialCount,
  initialUpvoted = false,
  signedIn,
  variant = "pill",
  className,
}: {
  requestId: string;
  initialCount: number;
  initialUpvoted?: boolean;
  signedIn: boolean;
  variant?: "pill" | "wide";
  className?: string;
}) {
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();

  function handleClick() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname ?? "/explore")}`);
      return;
    }

    const next = !upvoted;
    setUpvoted(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleUpvoteAction(requestId);
      if (!result.ok) {
        setUpvoted(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        if (result.error === "sign_in") {
          router.push(`/login?next=${encodeURIComponent(pathname ?? "/explore")}`);
        } else {
          push(result.error ?? "That didn't work — try again.", "error");
        }
        return;
      }
      setCount(result.count ?? count);
      setUpvoted(Boolean(result.upvoted));
    });
  }

  if (variant === "wide") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={upvoted}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-semibold transition",
          upvoted
            ? "border-brand bg-brand-soft text-brand-strong"
            : "border-line-strong bg-card text-ink hover:border-brand/40 hover:text-brand",
          className,
        )}
      >
        <ThumbUp size={16} />
        {upvoted ? "You want this" : "I want this too"}
        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[12px] tabular-nums">{count}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={upvoted}
      aria-label={`${upvoted ? "Remove your vote from" : "Add your vote to"} this request. ${count} people want it.`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition",
        upvoted
          ? "border-brand/30 bg-brand-soft text-brand-strong"
          : "border-line-strong bg-card text-ink-2 hover:border-brand/40 hover:text-brand",
        className,
      )}
    >
      <ThumbUp size={14} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
