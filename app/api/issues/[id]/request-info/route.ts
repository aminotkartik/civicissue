import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { requestInformation } from "@/lib/queries/issue-actions";
import { requestInfoSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = requestInfoSchema.parse(await readJson(req));
    await requestInformation(id, user, body.message);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
