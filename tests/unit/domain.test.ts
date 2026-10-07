import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, computePriority, scoreToPriority, estimateReportedDays } from "@/lib/priority/engine";
import { computeSlaDeadline, isOverdue, PLATFORM_DEFAULT_SLA_HOURS, slaHoursFor, slaStatusText } from "@/lib/sla/engine";
import { canTransition, allowedTransitions } from "@/lib/status/machine";
import { can, hasDepartmentScope, permissionsFor } from "@/lib/permissions/matrix";
import { abuseReportSchema, createIssueSchema, resolveSchema } from "@/lib/validation";

describe("priority engine", () => {
  it.each([
    [0, "LOW"], [25, "LOW"], [26, "MEDIUM"], [50, "MEDIUM"],
    [51, "HIGH"], [75, "HIGH"], [76, "CRITICAL"], [100, "CRITICAL"],
  ] as const)("maps score %i to %s", (score, expected) => {
    expect(scoreToPriority(score)).toBe(expected);
  });

  it("produces a deterministic, explainable score within configured weight limits", () => {
    const input = {
      severity: "HIGH" as const,
      categorySlug: "road-damage",
      title: "Dangerous pothole near a school on the main road",
      description: "Children have been injured here for 3 weeks.",
      upvotes: 25,
      confirmations: 2,
      weights: DEFAULT_WEIGHTS,
    };
    const result = computePriority(input);
    expect(result).toEqual(computePriority(input));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.priority).toBe("CRITICAL");
    expect(result.factors.map((factor) => factor.label)).toContain("Safety impact");
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it("extracts a reported duration from issue text", () => {
    expect(estimateReportedDays("The broken streetlight has been out for 3 weeks")).toBe(21);
    expect(estimateReportedDays("A fresh obstruction appeared today")).toBeUndefined();
  });
});

describe("SLA policy", () => {
  const customDefaults = { ...PLATFORM_DEFAULT_SLA_HOURS, HIGH: 36 };

  it("uses platform defaults for inherited category values and honors explicit category overrides", () => {
    expect(slaHoursFor("HIGH", { slaHighHours: PLATFORM_DEFAULT_SLA_HOURS.HIGH }, customDefaults)).toBe(36);
    expect(slaHoursFor("HIGH", { slaHighHours: 72 }, customDefaults)).toBe(72);
  });

  it("computes deadlines and treats the exact deadline as not yet overdue", () => {
    const start = new Date("2026-10-07T00:00:00.000Z");
    const deadline = computeSlaDeadline(start, "HIGH", null, customDefaults);
    expect(deadline.toISOString()).toBe("2026-10-08T12:00:00.000Z");
    expect(isOverdue(deadline, deadline)).toBe(false);
    expect(isOverdue(deadline, new Date(deadline.getTime() + 1))).toBe(true);
    expect(slaStatusText(deadline, deadline).tone).toBe("met");
  });
});

describe("issue status machine", () => {
  it("allows only declared transitions", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("SUBMITTED", "ASSIGNED")).toBe(false);
    expect(canTransition("CLOSED", "REOPENED")).toBe(true);
    expect(canTransition("RESOLVED", "RESOLVED")).toBe(false);
    expect(allowedTransitions("IN_PROGRESS")).toContain("RESOLVED");
  });
});

describe("role permission matrix", () => {
  it("keeps citizens, authorities, workers and admins within distinct capabilities", () => {
    expect(can("CITIZEN", "issue:reopenOwn")).toBe(true);
    expect(can("CITIZEN", "issue:reopenAny")).toBe(false);
    expect(can("AUTHORITY", "authority:viewDepartmentQueue")).toBe(true);
    expect(can("AUTHORITY", "users:manage")).toBe(false);
    expect(can("WORKER", "worker:updateAssignedJob")).toBe(true);
    expect(can("WORKER", "issue:assign")).toBe(false);
    expect(can("ADMIN", "analytics:viewPlatform")).toBe(true);
    expect(permissionsFor("WORKER")).not.toContain("users:manage");
  });
});

describe("resource authorization scopes", () => {
  it("requires a matching, non-empty department for authority access", () => {
    expect(hasDepartmentScope("roads", "roads")).toBe(true);
    expect(hasDepartmentScope("roads", "water")).toBe(false);
    expect(hasDepartmentScope(null, "roads")).toBe(false);
    expect(hasDepartmentScope("roads", null)).toBe(false);
  });
});

describe("request validation", () => {
  const validIssue = {
    title: "Pothole blocking a residential road",
    description: "A deep pothole has formed near the bus stop and is hazardous to two-wheelers.",
    categorySlug: "road-damage",
    severity: "HIGH",
    latitude: 18.5204,
    longitude: 73.8567,
  };

  it("accepts a valid issue and applies safe defaults", () => {
    const parsed = createIssueSchema.parse(validIssue);
    expect(parsed.imageKeys).toEqual([]);
    expect(parsed.locationPrivacy).toBe("EXACT");
    expect(parsed.isPublic).toBe(true);
  });

  it("rejects malformed coordinates, overlong issue text and invalid resolution evidence payloads", () => {
    expect(createIssueSchema.safeParse({ ...validIssue, latitude: 120 }).success).toBe(false);
    expect(createIssueSchema.safeParse({ ...validIssue, description: "short" }).success).toBe(false);
    expect(resolveSchema.safeParse({ description: "fixed it", imageKeys: [] }).success).toBe(false);
  });

  it("validates and normalizes abuse-report details", () => {
    const parsed = abuseReportSchema.parse({ entityType: "COMMENT", entityId: "comment-1", reasonType: "SPAM" });
    expect(parsed.details).toBe("");
    expect(abuseReportSchema.safeParse({ entityType: "COMMENT", entityId: "", reasonType: "SPAM" }).success).toBe(false);
  });
});
