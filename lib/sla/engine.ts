/**
 * Centralized SLA policy engine (spec §45, §88).
 *
 * SLA hours are configurable per category (categories table) with platform
 * defaults here. Nothing else in the codebase should hardcode SLA values.
 */
import type { Priority } from "@/lib/types";

export const PLATFORM_DEFAULT_SLA_HOURS: Record<Priority, number> = {
  CRITICAL: 24,
  HIGH: 48,
  MEDIUM: 120, // 5 days
  LOW: 240, // 10 days
};

export interface CategorySla {
  slaCriticalHours: number;
  slaHighHours: number;
  slaMediumHours: number;
  slaLowHours: number;
}

export function slaHoursFor(
  priority: Priority,
  category?: Partial<CategorySla> | null,
  platformDefaults: Record<Priority, number> = PLATFORM_DEFAULT_SLA_HOURS
): number {
  const categoryHours: Partial<Record<Priority, number>> = {
    CRITICAL: category?.slaCriticalHours,
    HIGH: category?.slaHighHours,
    MEDIUM: category?.slaMediumHours,
    LOW: category?.slaLowHours,
  };
  const override = categoryHours[priority];
  // Category rows are initialized with the original platform defaults. Treat
  // those unchanged values as inherited so an admin-configured platform SLA
  // is effective; a category value differing from the original is an override.
  if (override !== undefined && override !== PLATFORM_DEFAULT_SLA_HOURS[priority]) return override;
  return platformDefaults[priority];
}

export function computeSlaDeadline(
  from: Date,
  priority: Priority,
  category?: Partial<CategorySla> | null,
  platformDefaults: Record<Priority, number> = PLATFORM_DEFAULT_SLA_HOURS
): Date {
  const hours = slaHoursFor(priority, category, platformDefaults);
  return new Date(from.getTime() + hours * 3_600_000);
}

export function isOverdue(deadline: Date | null | undefined, now = new Date()): boolean {
  if (!deadline) return false;
  return now.getTime() > deadline.getTime();
}

/** Human-friendly remaining/exceeded time for SLA display. */
export function slaStatusText(
  deadline: Date | null | undefined,
  resolvedAt?: Date | null,
  now = new Date()
): { text: string; tone: "ok" | "soon" | "overdue" | "met" } {
  if (!deadline) return { text: "No SLA set", tone: "ok" };
  if (resolvedAt) {
    const met = resolvedAt.getTime() <= deadline.getTime();
    return met
      ? { text: "Resolved within SLA", tone: "met" }
      : { text: "Resolved after SLA", tone: "overdue" };
  }
  const diffMs = deadline.getTime() - now.getTime();
  const hours = diffMs / 3_600_000;
  if (hours < 0) {
    const over = Math.abs(hours);
    return {
      text: `Overdue by ${over >= 24 ? `${(over / 24).toFixed(1)} days` : `${Math.round(over)} hours`}`,
      tone: "overdue",
    };
  }
  if (hours < 12) {
    return { text: `Due in ${Math.max(1, Math.round(hours))} hours`, tone: "soon" };
  }
  return {
    text: `Due in ${hours >= 24 ? `${(hours / 24).toFixed(1)} days` : `${Math.round(hours)} hours`}`,
    tone: "ok",
  };
}

/**
 * Which open statuses are subject to SLA countdown.
 * SLA starts when the issue is verified/assigned (authority clock) but we
 * track overall from submission for transparency.
 */
export const SLA_TRACKED_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_INFORMATION",
  "REOPENED",
] as const;
