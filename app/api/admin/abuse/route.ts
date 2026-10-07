import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { abuseReports, comments, issues, users } from "@/drizzle/sqlite/schema";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";
import { ActionError } from "@/lib/queries/issue-actions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireRole("ADMIN", "AUTHORITY");
    const db = await getDb();
    const rows = await db.select().from(abuseReports).orderBy(desc(abuseReports.createdAt)).limit(100);
    if (actor.role === "ADMIN") return ok({ items: rows });

    // Authority moderation is limited to reports about cases in the actor's department.
    const deptRows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, actor.id)).limit(1);
    const departmentId = deptRows[0]?.departmentId;
    if (!departmentId) return ok({ items: [] });
    const issueIds = rows.filter((report) => report.entityType === "ISSUE").map((report) => report.entityId);
    const commentIds = rows.filter((report) => report.entityType === "COMMENT").map((report) => report.entityId);
    const issueRows = issueIds.length ? await db.select({ id: issues.id, departmentId: issues.departmentId }).from(issues).where(inArray(issues.id, issueIds)) : [];
    const commentRows = commentIds.length ? await db.select({ id: comments.id, issueId: comments.issueId }).from(comments).where(inArray(comments.id, commentIds)) : [];
    const parentIds = commentRows.map((comment) => comment.issueId);
    const parentRows = parentIds.length ? await db.select({ id: issues.id, departmentId: issues.departmentId }).from(issues).where(inArray(issues.id, parentIds)) : [];
    const permittedIssueIds = new Set([
      ...issueRows.filter((issue) => issue.departmentId === departmentId).map((issue) => issue.id),
      ...parentRows.filter((issue) => issue.departmentId === departmentId).map((issue) => issue.id),
    ]);
    const commentParent = new Map(commentRows.map((comment) => [comment.id, comment.issueId]));
    return ok({ items: rows.filter((report) => report.entityType === "ISSUE"
      ? permittedIssueIds.has(report.entityId)
      : report.entityType === "COMMENT" && permittedIssueIds.has(commentParent.get(report.entityId) ?? "")) });
  } catch (err) {
    return handleError(err);
  }
}

const reviewSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["DISMISSED", "REVIEWED"]),
  action: z.enum(["NONE", "HIDE_COMMENT", "HIDE_ISSUE", "RESTORE_COMMENT", "RESTORE_ISSUE"]).default("NONE"),
  note: z.string().trim().max(300).optional().default(""),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN", "AUTHORITY");
    const body = reviewSchema.parse(await readJson(req));
    const db = await getDb();
    const rows = await db.select().from(abuseReports).where(eq(abuseReports.id, body.reportId)).limit(1);
    const report = rows[0];
    if (!report) throw new ActionError("Abuse report not found.", 404);
    if (actor.role === "AUTHORITY") {
      if (report.entityType === "USER") return fail(403, "Department staff cannot moderate user accounts.");
      const deptRows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, actor.id)).limit(1);
      const departmentId = deptRows[0]?.departmentId;
      if (!departmentId) return fail(403, "Your account is not assigned to a department.");
      let targetIssueId = report.entityType === "ISSUE" ? report.entityId : null;
      if (report.entityType === "COMMENT") {
        const commentRows = await db.select({ issueId: comments.issueId }).from(comments).where(eq(comments.id, report.entityId)).limit(1);
        targetIssueId = commentRows[0]?.issueId ?? null;
      }
      const issueRows = targetIssueId ? await db.select({ departmentId: issues.departmentId }).from(issues).where(eq(issues.id, targetIssueId)).limit(1) : [];
      if (!issueRows[0] || issueRows[0].departmentId !== departmentId) return fail(403, "This report is outside your department scope.");
    }

    if (body.action === "HIDE_COMMENT" && report.entityType === "COMMENT") {
      await db.update(comments).set({ isHidden: true, hiddenReason: `Abuse report: ${report.reasonType}` }).where(eq(comments.id, report.entityId));
    }
    if (body.action === "RESTORE_COMMENT" && report.entityType === "COMMENT") {
      await db.update(comments).set({ isHidden: false, hiddenReason: null }).where(eq(comments.id, report.entityId));
    }
    if (body.action === "HIDE_ISSUE" && report.entityType === "ISSUE") {
      await db.update(issues).set({ isHidden: true }).where(eq(issues.id, report.entityId));
    }
    if (body.action === "RESTORE_ISSUE" && report.entityType === "ISSUE") {
      await db.update(issues).set({ isHidden: false }).where(eq(issues.id, report.entityId));
    }
    await db.update(abuseReports).set({
      status: body.decision,
      reviewedById: actor.id,
      reviewNote: body.note || null,
    }).where(and(eq(abuseReports.id, body.reportId)));

    await recordAudit({ id: actor.id, email: actor.email }, `ABUSE_${body.decision}`, report.entityType, report.entityId, {
      reportId: report.id,
      action: body.action,
      note: body.note || null,
    });
    return ok({ reviewed: true });
  } catch (err) {
    return handleError(err);
  }
}
