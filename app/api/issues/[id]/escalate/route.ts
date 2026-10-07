import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { escalateIssue } from "@/lib/queries/issue-actions";
import { z } from "zod";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = z.object({ reason: z.string().trim().max(500).optional() }).parse(await readJson(req).catch(() => ({})));
    await escalateIssue(id, user, body.reason);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
