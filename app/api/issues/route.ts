import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/sqlite/schema";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { listIssues, createIssue } from "@/lib/queries/issues";
import { sweepOverdue } from "@/lib/queries/issue-actions";
import { createIssueSchema, listIssuesQuerySchema } from "@/lib/validation";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { getWorkerByUserId } from "@/lib/queries/references";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { requestIp } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    const url = new URL(req.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const query = listIssuesQuerySchema.parse(raw);
    const wantsStaff = raw.scope === "staff" && viewer && ["AUTHORITY", "ADMIN", "WORKER"].includes(viewer.role);
    const scope = query.mine === "true" ? "mine" : wantsStaff ? "staff" : "public";
    let departmentId: string | null | undefined;
    let workerId: string | undefined;
    if (scope === "staff" && viewer?.role === "AUTHORITY") {
      const db = await getDb();
      const rows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, viewer.id)).limit(1);
      departmentId = rows[0]?.departmentId ?? null;
      if (!departmentId) return fail(403, "Your account is not assigned to a department.");
    } else if (scope === "staff" && viewer?.role === "WORKER") {
      const worker = await getWorkerByUserId(viewer.id);
      workerId = worker?.worker.id;
      if (!workerId) return ok({ items: [], total: 0, page: query.page, pageSize: query.pageSize, totalPages: 0 });
    }
    const result = await listIssues({ query, viewer, scope, departmentId, workerId });
    // Keep overdue flags fresh on every list request (lazy sweep, spec §45).
    sweepOverdue().catch(() => {});
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    checkRateLimit(`issue:${clientKey(req, user.id)}`, LIMITS.issueCreate);
    const input = createIssueSchema.parse(await readJson(req));
    const result = await createIssue(input, user, { ip: requestIp(req) });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
