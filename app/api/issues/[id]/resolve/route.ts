import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { resolveIssue } from "@/lib/queries/issue-actions";
import { resolveSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = resolveSchema.parse(await readJson(req));
    await resolveIssue(id, user, body);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
