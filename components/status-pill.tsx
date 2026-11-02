import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/lib/status";
import { cn } from "@/lib/cn";

const toneToBadge = {
  neutral: "neutral",
  info: "info",
  accent: "accent",
  progress: "accent",
  success: "success",
  warn: "warn",
  danger: "danger",
} as const;

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <Badge tone={toneToBadge[meta.tone]} dot className={cn("capitalize", className)}>
      {meta.learnerLabel}
    </Badge>
  );
}
