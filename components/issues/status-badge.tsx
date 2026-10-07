import { Badge, type BadgeTone } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONES, STATUS_DESCRIPTIONS } from "@/lib/status/machine";
import type { IssueStatus } from "@/lib/types";

const TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  positive: "positive",
  active: "active",
  success: "success",
  negative: "negative",
  critical: "critical",
  neutral: "neutral",
};

/**
 * Status badge — always shows a dot + text label, never color alone
 * (accessibility spec §61/§98). `title` gives screen-reader-friendly context.
 */
export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <Badge tone={TONE_MAP[STATUS_TONES[status]]} dot className={className}>
      <span title={STATUS_DESCRIPTIONS[status]}>{STATUS_LABELS[status]}</span>
    </Badge>
  );
}
