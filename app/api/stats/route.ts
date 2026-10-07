import { getPlatformStats } from "@/lib/queries/analytics";
import { ok, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    return ok(await getPlatformStats());
  } catch (err) {
    return handleError(err);
  }
}
