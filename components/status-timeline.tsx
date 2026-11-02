import { Check, Clock, Close } from "@/components/icons";
import { JOURNEY, statusMeta } from "@/lib/status";
import { cn } from "@/lib/cn";

export function StatusTimeline({ status }: { status: string }) {
  const meta = statusMeta(status);
  const current = meta.step;

  if (status === "declined") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3">
        <Close size={16} className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="text-[14px] font-semibold text-danger">This one isn&apos;t going ahead</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
            We&apos;d rather be straight with you than leave it hanging. The reason is below — and you can always ask
            for a narrower version.
          </p>
        </div>
      </div>
    );
  }

  if (status === "waitlisted") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3">
        <Clock size={16} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <p className="text-[14px] font-semibold text-warn">On the waitlist — and moving up</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
            We cap filming to keep quality high. Your request keeps its place and gets promoted automatically when a
            slot opens. You&apos;ll hear from us either way.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="grid gap-0 sm:grid-cols-5" aria-label="Request progress">
      {JOURNEY.map((step, index) => {
        const position = index + 1;
        const done = position < current;
        const active = position === current;
        return (
          <li key={step.key} className="relative flex gap-3 sm:flex-col sm:items-start sm:gap-2">
            {index < JOURNEY.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px sm:left-7 sm:top-[11px] sm:h-px sm:w-[calc(100%-1.75rem)]",
                  done ? "bg-brand" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-brand bg-brand text-white",
                active && "border-brand bg-brand-soft text-brand-strong ring-4 ring-brand/15",
                !done && !active && "border-line bg-card text-ink-3",
              )}
            >
              {done ? <Check size={12} strokeWidth={3} /> : active ? <span className="h-2 w-2 rounded-full bg-brand" /> : position}
            </span>
            <span className={cn("pb-4 sm:pb-0 sm:pr-2", active ? "text-ink" : "text-ink-3")}>
              <span className="block text-[13px] font-semibold">{step.label}</span>
              <span className="mt-0.5 hidden text-[11.5px] leading-snug sm:block">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
