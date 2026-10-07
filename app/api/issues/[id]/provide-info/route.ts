import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { provideInformation } from "@/lib/queries/issue-actions";
import { provideInfoSchema } from "@/lib/validation";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = provideInfoSchema.parse(await readJson(req));
    await provideInformation(id, user, body.message, body.imageKeys);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
