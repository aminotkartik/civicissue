import { Check } from "lucide-react";
import { LIFECYCLE_STAGES, lifecycleIndex } from "@/lib/status/machine";
import type { IssueStatus } from "@/lib/types";
import { cn } from "@/lib/utils/format";

/** Issue lifecycle strip (spec §124): REPORT → REVIEW → … → CLOSE. */
export function LifecycleBar({ status, className }: { status: IssueStatus; className?: string }) {
  const current = lifecycleIndex(status);
  const rejected = status === "REJECTED";
  return (
    <div className={cn("w-full", className)} role="img" aria-label={`Lifecycle stage: ${LIFECYCLE_STAGES[Math.min(current, LIFECYCLE_STAGES.length - 1)]?.label ?? status}`}>
      <div className="flex items-center">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const done = !rejected && i <= current;
          const isCurrent = !rejected && i === current;
          return (
            <div key={stage.key} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <div className={cn("h-0.5 flex-1 mx-1", i <= current && !rejected ? "bg-verdant" : "bg-line")} aria-hidden />
              )}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                    rejected && i === 2
                      ? "border-alert bg-alert text-white"
                      : done
                        ? "border-verdant bg-verdant text-white"
                        : isCurrent
                          ? "border-terra-500 bg-terra-50 text-terra-600"
                          : "border-line-strong bg-surface text-ink-muted"
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]",
                    rejected && i === 2 ? "text-alert" : done || isCurrent ? "text-ink" : "text-ink-muted"
                  )}
                >
                  {rejected && i === 2 ? "Rejected" : stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
