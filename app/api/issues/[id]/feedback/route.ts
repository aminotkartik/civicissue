import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { submitFeedback } from "@/lib/queries/issue-actions";
import { feedbackSchema } from "@/lib/validation";
import { ok, handleError, readJson } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = feedbackSchema.parse(await readJson(req));
    await submitFeedback(id, user, body);
    return ok({ saved: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
