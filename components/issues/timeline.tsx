import { Check, Circle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/format";

export interface TimelineItem {
  id?: string;
  message: string;
  timestamp: Date | string | number;
  done: boolean;
  actorName?: string | null;
  actorRole?: string | null;
  tone?: "default" | "success" | "warning" | "danger";
}

/** Generic timeline renderer (spec §143) used on dashboards & issue pages. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-0", className)} aria-label="Issue progress timeline">
      {items.map((item, i) => (
        <li key={item.id ?? i} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span
              className={cn(
                "absolute left-[11px] top-6 h-full w-0.5",
                item.done ? "bg-verdant/30" : "bg-line"
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border-2",
              item.done
                ? item.tone === "danger"
                  ? "border-alert bg-alert-soft text-alert"
                  : item.tone === "warning"
                    ? "border-amber-accent bg-amber-soft text-amber-accent"
                    : "border-verdant bg-verdant-soft text-verdant"
                : "border-line-strong bg-surface text-ink-muted"
            )}
            aria-hidden
          >
            {item.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm leading-snug", item.done ? "text-ink font-medium" : "text-ink-muted")}>
              {item.message}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Clock className="h-3 w-3" aria-hidden />
              {formatDateTime(item.timestamp)}
              {item.actorRole && item.actorRole !== "SYSTEM" && (
                <span className="rounded bg-surface-2 px-1.5 py-px font-medium text-ink-soft">
                  {item.actorRole === "CITIZEN" ? "Citizen" : item.actorRole === "AUTHORITY" ? "Authority" : item.actorRole === "WORKER" ? "Field Worker" : "Admin"}
                </span>
              )}
              {item.actorRole === "SYSTEM" && (
                <span className="rounded bg-info-soft px-1.5 py-px font-medium text-info">System</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
