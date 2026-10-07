import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { abuseReports, auditLogs, comments, issues, users } from "@/drizzle/sqlite/schema";
import { ModerationConsole, type AbuseReportView, type AuditLogView } from "@/components/admin/moderation-console";

export const metadata: Metadata = { title: "Moderation & audit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login?next=/admin/moderation");
  if (actor.role !== "ADMIN") redirect("/dashboard");
  const db = await getDb();
  const [rawReports, logsRaw] = await Promise.all([
    db.select({ report: abuseReports, reporterName: users.name })
      .from(abuseReports)
      .leftJoin(users, eq(abuseReports.reporterId, users.id))
      .orderBy(desc(abuseReports.createdAt))
      .limit(100),
    db.select({ log: auditLogs })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  ]);
  const commentIds = rawReports.filter(({ report }) => report.entityType === "COMMENT").map(({ report }) => report.entityId);
  const userIds = rawReports.filter(({ report }) => report.entityType === "USER").map(({ report }) => report.entityId);
  const issueIds = rawReports.filter(({ report }) => report.entityType === "ISSUE").map(({ report }) => report.entityId);
  const [commentRows, targetUsers] = await Promise.all([
    commentIds.length ? db.select({ id: comments.id, content: comments.content, issueId: comments.issueId, isHidden: comments.isHidden }).from(comments).where(inArray(comments.id, commentIds)) : Promise.resolve([]),
    userIds.length ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
  ]);
  const commentById = new Map(commentRows.map((comment) => [comment.id, comment]));
  for (const comment of commentRows) issueIds.push(comment.issueId);
  const issueRows = issueIds.length ? await db.select({ id: issues.id, publicId: issues.publicId, title: issues.title, isHidden: issues.isHidden }).from(issues).where(inArray(issues.id, [...new Set(issueIds)])) : [];
  const issueById = new Map(issueRows.map((issue) => [issue.id, issue]));
  const userById = new Map(targetUsers.map((target) => [target.id, target]));

  const reports: AbuseReportView[] = rawReports.map(({ report, reporterName }) => {
    let targetTitle = `Unavailable ${report.entityType.toLowerCase()} content`;
    let targetLink: string | null = null;
    let action: AbuseReportView["action"] = "NONE";
    if (report.entityType === "ISSUE") {
      const issue = issueById.get(report.entityId);
      targetTitle = issue ? `${issue.publicId} · ${issue.title}` : "Issue no longer exists";
      targetLink = issue ? `/issues/${issue.publicId}` : null;
      if (issue?.isHidden) action = "HIDE_ISSUE";
    } else if (report.entityType === "COMMENT") {
      const comment = commentById.get(report.entityId);
      const issue = comment ? issueById.get(comment.issueId) : undefined;
      targetTitle = comment ? `Comment: ${comment.content.slice(0, 180)}${comment.content.length > 180 ? "…" : ""}` : "Comment no longer exists";
      targetLink = issue ? `/issues/${issue.publicId}` : null;
      if (comment?.isHidden) action = "HIDE_COMMENT";
    } else {
      const target = userById.get(report.entityId);
      targetTitle = target ? `${target.name} · ${target.email}` : "User account no longer exists";
    }
    return {
      id: report.id,
      entityType: report.entityType,
      entityId: report.entityId,
      reasonType: report.reasonType,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
      reporterName: reporterName ?? "Community member",
      targetTitle,
      targetLink,
      action,
    };
  });
  const logs: AuditLogView[] = logsRaw.map(({ log }) => ({
    id: log.id,
    actorEmail: log.actorEmail,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4"><Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Admin console</Link></nav>
      <header className="mb-7"><h1 className="text-2xl font-bold tracking-tight text-ink">Moderation & audit</h1><p className="mt-1 text-sm text-ink-muted">Respond to abuse reports and maintain an accountable record of platform actions.</p></header>
      <ModerationConsole reports={reports} auditLogs={logs} />
    </div>
  );
}
