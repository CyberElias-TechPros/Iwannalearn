import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-soft hover:bg-brand-strong active:bg-brand-strong border border-transparent",
  secondary:
    "bg-card text-ink border border-line-strong hover:bg-paper-2 hover:border-ink-3/40",
  ghost: "bg-transparent text-ink-2 hover:bg-paper-2 border border-transparent",
  soft: "bg-brand-soft text-brand-strong border border-transparent hover:bg-[#d5ecdf]",
  danger: "bg-danger text-white border border-transparent hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13.5px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-medium transition duration-150",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55 select-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
