/**
 * Centralized domain types & enums for CivicIssue.
 * Kept framework-free so they can be used in tests, scripts and API layers.
 */

export const ISSUE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_INFORMATION",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "ESCALATED",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];
export type Severity = Priority;

export const USER_ROLES = ["CITIZEN", "AUTHORITY", "WORKER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const IMAGE_TYPES = ["BEFORE", "PROGRESS", "AFTER", "OTHER"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const LOCATION_PRIVACY = ["EXACT", "APPROXIMATE"] as const;
export type LocationPrivacy = (typeof LOCATION_PRIVACY)[number];

export const REJECTION_REASONS = [
  "INSUFFICIENT_INFORMATION",
  "DUPLICATE",
  "NOT_A_CIVIC_ISSUE",
  "INCORRECT_LOCATION",
  "FALSE_OR_MISLEADING",
  "ALREADY_RESOLVED",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const ABUSE_REASON_TYPES = [
  "SPAM",
  "OFFENSIVE",
  "FALSE_INFO",
  "PII",
  "FRAUD",
  "OTHER",
] as const;

export type NotificationType =
  | "ISSUE_SUBMITTED"
  | "ISSUE_VERIFIED"
  | "ISSUE_REJECTED"
  | "WORKER_ASSIGNED"
  | "STATUS_CHANGED"
  | "INFO_REQUESTED"
  | "ISSUE_RESOLVED"
  | "ISSUE_REOPENED"
  | "COMMENT_REPLY"
  | "NEARBY_UPDATE"
  | "ESCALATION"
  | "FEEDBACK_REQUEST"
  | "SYSTEM";

/** Public shape of an issue used by list/card views (no private fields). */
export interface IssueCardData {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryIcon: string;
  status: IssueStatus;
  priority: Priority;
  priorityScore: number;
  locality: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  locationPrivacy: LocationPrivacy;
  upvotesCount: number;
  commentsCount: number;
  confirmationsCount: number;
  coverImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  departmentName?: string | null;
  distanceKm?: number;
}

export const OPEN_STATUSES: IssueStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_INFORMATION",
  "REOPENED",
  "ESCALATED",
];

export const RESOLVED_STATUSES: IssueStatus[] = ["RESOLVED", "CLOSED"];

export function isOpenStatus(s: IssueStatus): boolean {
  return OPEN_STATUSES.includes(s);
}
