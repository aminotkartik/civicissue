import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { abuseReportSchema } from "@/lib/validation";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { abuseReports, comments, issues, users } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    checkRateLimit(`abuse:${clientKey(req, user.id)}`, LIMITS.commentCreate);
    const raw = (await readJson(req)) as Record<string, unknown>;
    const body = abuseReportSchema.parse({ ...raw, entityId: raw.entityId ?? id });
    const db = await getDb();
    let canonicalId: string | undefined;
    if (body.entityType === "ISSUE") {
      const rows = await db.select({ id: issues.id }).from(issues)
        .where(or(eq(issues.id, body.entityId), eq(issues.publicId, body.entityId.toUpperCase())))
        .limit(1);
      canonicalId = rows[0]?.id;
    } else if (body.entityType === "COMMENT") {
      const rows = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, body.entityId)).limit(1);
      canonicalId = rows[0]?.id;
    } else {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, body.entityId)).limit(1);
      canonicalId = rows[0]?.id;
    }
    if (!canonicalId) return fail(404, "The reported content could not be found.");
    await db.insert(abuseReports).values({
      id: uuid(),
      reporterId: user.id,
      entityType: body.entityType,
      entityId: canonicalId,
      reasonType: body.reasonType,
      details: body.details || null,
    });
    return ok({ reported: true, message: "Thanks — our moderators will review this." }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
