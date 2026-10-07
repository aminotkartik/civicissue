import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { setPriority } from "@/lib/queries/issue-actions";
import { z } from "zod";
import { PRIORITY_LEVELS } from "@/lib/types";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = z.object({ priority: z.enum(PRIORITY_LEVELS), reason: z.string().trim().min(5).max(500) }).parse(await readJson(req));
    await setPriority(id, user, body.priority, body.reason);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
