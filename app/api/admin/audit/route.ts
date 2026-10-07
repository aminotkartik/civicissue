import { NextRequest } from "next/server";
import { desc, eq, like, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/drizzle/sqlite/schema";
import { ok, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const action = url.searchParams.get("action") ?? undefined;
    const db = await getDb();
    const where = action ? like(sql`lower(${auditLogs.action})`, `%${action.toLowerCase()}%`) : undefined;
    void eq;
    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50)
      .offset((page - 1) * 50);
    return ok({ items: rows, page });
  } catch (err) {
    return handleError(err);
  }
}
