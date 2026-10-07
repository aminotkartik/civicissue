import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-terra-50 text-terra-600">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-ink-muted leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this content. Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-alert/25 bg-alert-soft/50 px-6 py-10 text-center" role="alert">
      <h3 className="text-sm font-semibold text-alert">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 h-9 rounded-lg bg-alert px-4 text-sm font-semibold text-white hover:brightness-95"
        >
          Try again
        </button>
      )}
    </div>
  );
}
