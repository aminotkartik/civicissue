import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { eq } from "drizzle-orm";
import {
  getTimeSeries,
  getByCategory,
  getByLocality,
  getByStatus,
  getByPriority,
  getSatisfaction,
  getAuthorityCounters,
} from "@/lib/queries/analytics";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "AUTHORITY" && user.role !== "ADMIN") {
      return fail(403, "Authority staff only.");
    }
    const db = await getDb();
    let departmentId: string | null = null;
    if (user.role === "AUTHORITY") {
      const rows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, user.id)).limit(1);
      departmentId = rows[0]?.departmentId ?? null;
      if (!departmentId) return fail(403, "Your account is not assigned to a department.");
    }
    const [timeSeries, byCategory, byLocality, byStatus, byPriority, satisfaction, counters] =
      await Promise.all([
        getTimeSeries(30, departmentId),
        getByCategory(departmentId),
        getByLocality(10, departmentId),
        getByStatus(departmentId),
        getByPriority(departmentId),
        getSatisfaction(departmentId),
        getAuthorityCounters(departmentId),
      ]);
    return ok({ departmentId, timeSeries, byCategory, byLocality, byStatus, byPriority, satisfaction, counters });
  } catch (err) {
    return handleError(err);
  }
}
