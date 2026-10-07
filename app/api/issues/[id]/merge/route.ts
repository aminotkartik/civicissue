import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { mergeIssues } from "@/lib/queries/issue-actions";
import { publicIdSchema } from "@/lib/validation";
import { z } from "zod";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = z.object({ canonicalPublicId: publicIdSchema }).parse(await readJson(req));
    await mergeIssues(id, body.canonicalPublicId, user);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
