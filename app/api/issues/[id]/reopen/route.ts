import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { reopenIssue } from "@/lib/queries/issue-actions";
import { reopenSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = reopenSchema.parse(await readJson(req));
    await reopenIssue(id, user, body);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
