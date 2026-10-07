import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils/format";

const CONFIG: Record<Priority, { label: string; tone: "neutral" | "warning" | "terra" | "critical" }> = {
  LOW: { label: "● LOW", tone: "neutral" },
  MEDIUM: { label: "● MEDIUM", tone: "warning" },
  HIGH: { label: "● HIGH", tone: "terra" },
  CRITICAL: { label: "● CRITICAL", tone: "critical" },
};

export function PriorityBadge({ priority, score, className }: { priority: Priority; score?: number; className?: string }) {
  const c = CONFIG[priority];
  return (
    <Badge
      tone={c.tone}
      className={cn(priority === "CRITICAL" && "animate-none font-bold", className)}
    >
      <span title={score !== undefined ? `Priority score ${score}/100` : undefined}>
        {c.label}
        {score !== undefined && <span className="ml-1 font-normal opacity-70">{score}</span>}
      </span>
    </Badge>
  );
}
