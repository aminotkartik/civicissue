import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export type BadgeTone =
  | "neutral"
  | "terra"
  | "info"
  | "warning"
  | "positive"
  | "success"
  | "negative"
  | "critical"
  | "active";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-soft border-line",
  terra: "bg-terra-50 text-terra-700 border-terra-200",
  info: "bg-info-soft text-info border-info/20",
  warning: "bg-amber-soft text-amber-accent border-amber-accent/25",
  positive: "bg-verdant-soft text-verdant border-verdant/25",
  success: "bg-verdant-soft text-verdant border-verdant/25",
  negative: "bg-alert-soft text-alert border-alert/25",
  critical: "bg-alert-soft text-alert border-alert/30",
  active: "bg-active-soft text-active border-active/25",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
