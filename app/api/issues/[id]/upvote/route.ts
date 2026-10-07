import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { toggleUpvote } from "@/lib/queries/issue-actions";
import { ok, handleError } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function handle(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    checkRateLimit(`upvote:${clientKey(req, user.id)}`, LIMITS.upvote);
    return ok(await toggleUpvote(id, user));
  } catch (err) {
    return handleError(err);
  }
}

export const POST = handle;
export const DELETE = handle;
