import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { moderateComment } from "@/lib/queries/issue-actions";
import { ok, handleError, readJson } from "@/lib/api/respond";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["hide", "restore", "delete"]),
  reason: z.string().trim().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const { cid } = await params;
    const user = await requireUser();
    const body = schema.parse(await readJson(req));
    await moderateComment(cid, user, body.action, body.reason);
    return ok({ moderated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const { cid } = await params;
    const user = await requireUser();
    await moderateComment(cid, user, "delete");
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
