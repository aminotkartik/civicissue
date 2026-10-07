import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { rejectIssue } from "@/lib/queries/issue-actions";
import { rejectSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = rejectSchema.parse(await readJson(req));
    await rejectIssue(id, user, body.reason, body.note);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
