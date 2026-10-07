import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { assignIssue } from "@/lib/queries/issue-actions";
import { assignSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = assignSchema.parse(await readJson(req));
    await assignIssue(id, user, body);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
