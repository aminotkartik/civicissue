import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { toggleFollow } from "@/lib/queries/issue-actions";
import { ok, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

async function handle(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    return ok(await toggleFollow(id, user));
  } catch (err) {
    return handleError(err);
  }
}

export const POST = handle;
export const DELETE = handle;
