import { cn } from "@/lib/cn";

export type Tone = "neutral" | "info" | "accent" | "progress" | "success" | "warn" | "danger" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  info: "bg-info-soft text-info border-info/15",
  accent: "bg-accent-soft text-[#8a5209] border-accent/20",
  progress: "bg-accent-soft text-[#8a5209] border-accent/25",
  success: "bg-brand-soft text-brand-strong border-brand/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  brand: "bg-brand text-white border-brand",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium leading-5 whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
