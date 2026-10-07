"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/format";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-terra-600 text-white hover:bg-terra-700 active:bg-terra-800 shadow-sm disabled:bg-terra-300",
  secondary:
    "bg-surface-2 text-ink hover:bg-line active:bg-line-strong border border-line",
  outline:
    "bg-transparent text-terra-700 border border-terra-300 hover:bg-terra-50 active:bg-terra-100",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
  danger: "bg-alert text-white hover:brightness-95 active:brightness-90 shadow-sm",
  success: "bg-verdant text-white hover:brightness-95 active:brightness-90 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors select-none",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
  ariaLabel?: string;
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children, external, ariaLabel }: ButtonLinkProps) {
  const cls = cn(
    "inline-flex items-center justify-center font-medium transition-colors select-none",
    VARIANTS[variant],
    SIZES[size],
    className
  );
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
