import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/status-pill";
import { UpvoteButton } from "@/components/upvote-button";
import { Clock, Lock } from "@/components/icons";
import { levelLabel, plural, relativeTime, tierMeta } from "@/lib/status";
import type { RequestSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

export function RequestCard({
  request,
  signedIn,
  compact = false,
  className,
}: {
  request: RequestSummary;
  signedIn: boolean;
  compact?: boolean;
  className?: string;
}) {
  const waiting = request.upvoteCount;

  return (
    <article
      className={cn(
        "group surface flex h-full flex-col gap-3 p-5 transition hover:border-line-strong hover:shadow-lift",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{request.category}</Badge>
        <StatusPill status={request.status} />
        {request.tier !== "community" && request.visibility === "public" && (
          <Badge tone="accent">{tierMeta(request.tier).label}</Badge>
        )}
        {request.visibility === "private" && (
          <Badge tone="neutral">
            <Lock size={11} /> Private
          </Badge>
        )}
      </div>

      <h3 className={cn("text-[19px] font-semibold leading-snug", compact && "text-[17px]")}>
        <Link href={`/requests/${request.slug}`} className="hover:text-brand">
          {request.title}
        </Link>
      </h3>

      {!compact && <p className="line-clamp-2 text-[14px] leading-relaxed text-ink-3">{request.goal}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Clock size={13} />
          {relativeTime(request.createdAt)}
          <span aria-hidden="true">·</span>
          {levelLabel(request.level)}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-ink-3">
            {waiting > 0 ? `${plural(waiting, "person", "people")} waiting` : "Be the first"}
          </span>
          <UpvoteButton
            requestId={request.id}
            initialCount={request.upvoteCount}
            initialUpvoted={request.viewerUpvoted}
            signedIn={signedIn}
          />
        </div>
      </div>
    </article>
  );
}
