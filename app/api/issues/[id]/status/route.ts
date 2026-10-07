import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { transitionStatus } from "@/lib/queries/issue-actions";
import { statusSchema } from "@/lib/validation";
import { assertCan } from "@/lib/permissions/matrix";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = statusSchema.parse(await readJson(req));
    if (body.status !== "IN_PROGRESS") {
      return fail(400, "Use the dedicated workflow for verification, assignment, resolution, and other status changes.");
    }
    assertCan(user.role, "issue:updateStatus");
    await transitionStatus(id, { to: body.status, actor: user, note: body.note || null });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
