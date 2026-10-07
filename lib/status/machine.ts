/**
 * Issue status state machine — the single source of truth for which
 * transitions are legal (spec §22). All status changes must go through
 * lib/queries/issues.transitionStatus so history, events, notifications
 * and audit logging are recorded consistently.
 */
import type { IssueStatus } from "@/lib/types";

/** Allowed transitions: from → list of valid targets. */
export const STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: [
    "VERIFIED",
    "REJECTED",
    "WAITING_FOR_INFORMATION",
    "ESCALATED",
  ],
  VERIFIED: ["ASSIGNED", "ESCALATED", "WAITING_FOR_INFORMATION", "REJECTED"],
  WAITING_FOR_INFORMATION: ["UNDER_REVIEW", "VERIFIED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "ESCALATED", "VERIFIED"],
  IN_PROGRESS: ["RESOLVED", "ESCALATED", "WAITING_FOR_INFORMATION"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW", "ESCALATED"],
  ESCALATED: ["ASSIGNED", "IN_PROGRESS", "UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"], // appeal / moderation recovery path
  CLOSED: ["REOPENED"],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  if (from === to) return false;
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: IssueStatus): IssueStatus[] {
  return STATUS_TRANSITIONS[from] ?? [];
}

export const STATUS_LABELS: Record<IssueStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_INFORMATION: "Waiting for Information",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

/** Accessible one-line explanations (spec §114). */
export const STATUS_DESCRIPTIONS: Record<IssueStatus, string> = {
  DRAFT: "Draft — not submitted yet",
  SUBMITTED: "Submitted — waiting for review",
  UNDER_REVIEW: "Under review — authority is checking the report",
  VERIFIED: "Verified — confirmed by authority",
  REJECTED: "Rejected — not accepted as a valid civic issue",
  ASSIGNED: "Assigned — sent to the responsible team",
  IN_PROGRESS: "In progress — work has started",
  WAITING_FOR_INFORMATION: "Waiting for information from the reporter",
  RESOLVED: "Resolved — authority marked it fixed",
  CLOSED: "Closed — resolution confirmed and archived",
  REOPENED: "Reopened — citizen reported the problem remains",
  ESCALATED: "Escalated — resolution is overdue or needs senior attention",
};

/** Semantic tone used by StatusBadge (never color alone — labels accompany). */
export type StatusTone =
  | "info"
  | "warning"
  | "positive"
  | "active"
  | "success"
  | "negative"
  | "critical"
  | "neutral";

export const STATUS_TONES: Record<IssueStatus, StatusTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  VERIFIED: "positive",
  REJECTED: "negative",
  ASSIGNED: "info",
  IN_PROGRESS: "active",
  WAITING_FOR_INFORMATION: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  REOPENED: "warning",
  ESCALATED: "critical",
};

/** Lifecycle stages for the progress visualization (spec §124). */
export const LIFECYCLE_STAGES: {
  key: string;
  label: string;
  statuses: IssueStatus[];
}[] = [
  { key: "report", label: "Report", statuses: ["SUBMITTED", "DRAFT"] },
  { key: "review", label: "Review", statuses: ["UNDER_REVIEW", "WAITING_FOR_INFORMATION"] },
  { key: "verify", label: "Verify", statuses: ["VERIFIED"] },
  { key: "assign", label: "Assign", statuses: ["ASSIGNED"] },
  { key: "work", label: "Work", statuses: ["IN_PROGRESS"] },
  { key: "resolve", label: "Resolve", statuses: ["RESOLVED"] },
  { key: "close", label: "Close", statuses: ["CLOSED"] },
];

export function lifecycleIndex(status: IssueStatus): number {
  const idx = LIFECYCLE_STAGES.findIndex((s) => s.statuses.includes(status));
  if (idx >= 0) return idx;
  if (status === "REOPENED" || status === "ESCALATED") return 4; // back to work
  if (status === "REJECTED") return 2;
  return 0;
}

export const REJECTION_REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_INFORMATION: "Insufficient information",
  DUPLICATE: "Duplicate of an existing report",
  NOT_A_CIVIC_ISSUE: "Not a civic issue",
  INCORRECT_LOCATION: "Incorrect location",
  FALSE_OR_MISLEADING: "False or misleading submission",
  ALREADY_RESOLVED: "Already resolved",
};
