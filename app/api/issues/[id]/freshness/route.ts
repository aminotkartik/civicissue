import { NextRequest } from "next/server";
import { getIssueFreshness } from "@/lib/queries/issues";
import { ok, fail, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fresh = await getIssueFreshness(id);
    if (!fresh) return fail(404, "This complaint could not be found.");
    return ok(fresh);
  } catch (err) {
    return handleError(err);
  }
}
