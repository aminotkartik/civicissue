import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "terra" | "warning" | "success" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    default: "bg-surface-2 text-ink-soft",
    terra: "bg-terra-50 text-terra-600",
    warning: "bg-amber-soft text-amber-accent",
    success: "bg-verdant-soft text-verdant",
    danger: "bg-alert-soft text-alert",
    info: "bg-info-soft text-info",
  };
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}
