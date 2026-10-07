import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { addComment } from "@/lib/queries/issue-actions";
import { commentSchema } from "@/lib/validation";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    checkRateLimit(`comment:${clientKey(req, user.id)}`, LIMITS.commentCreate);
    const body = commentSchema.parse(await readJson(req));
    const result = await addComment(id, user, body.content);
    return ok(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
