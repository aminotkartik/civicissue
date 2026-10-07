import { clearSessionCookie } from "@/lib/auth/session";
import { ok, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ loggedOut: true });
  } catch (err) {
    return handleError(err);
  }
}
