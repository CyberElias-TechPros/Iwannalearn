import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Check } from "@/components/icons";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[14.5px] font-semibold text-ink">
          {label}
        </label>
        {optional && <span className="text-[12.5px] text-ink-3">Optional</span>}
      </div>
      {hint && <p className="text-[13.5px] leading-snug text-ink-3">{hint}</p>}
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-[13px] font-medium text-danger" role="alert">
          <span aria-hidden="true">•</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const base =
  "w-full rounded-xl border bg-card px-3.5 text-[15px] text-ink placeholder:text-ink-3/70 transition " +
  "focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand " +
  "disabled:opacity-60";

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(base, "h-11 border-line-strong", invalid && "border-danger focus:border-danger focus:ring-danger/15", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(base, "min-h-[110px] resize-y py-3 leading-relaxed border-line-strong", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(base, "h-11 appearance-none border-line-strong pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true">
        ▾
      </span>
    </div>
  );
}

export function ValidNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-brand">
      <Check size={14} />
      {children}
    </p>
  );
}
