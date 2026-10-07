import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { confirmIssue } from "@/lib/queries/issue-actions";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = z.object({ note: z.string().trim().max(300).optional() }).parse(await readJson(req).catch(() => ({})));
    return ok(await confirmIssue(id, user, body.note), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
