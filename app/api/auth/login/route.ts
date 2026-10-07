import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth/session";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ROLE_HOME: Record<string, string> = {
  CITIZEN: "/dashboard",
  AUTHORITY: "/authority",
  WORKER: "/worker",
  ADMIN: "/admin",
};

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await readJson(req));
    checkRateLimit(`login:${clientKey(req)}:${body.email}`, LIMITS.login);

    const db = await getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);
    const user = rows[0];

    // Generic error — never reveal whether the email exists (spec §10).
    const generic = "Incorrect email or password. Please try again.";
    if (!user || !user.passwordHash) {
      // Equalize timing for non-existent accounts.
      await verifyPassword(body.password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
      return fail(401, generic);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      await recordAudit(null, "LOGIN_FAILED", "USER", user.id, { email: user.email });
      return fail(401, generic);
    }
    if (user.isSuspended || !user.isActive) {
      return fail(
        403,
        user.isSuspended
          ? `This account is suspended.${user.suspensionReason ? ` Reason: ${user.suspensionReason}` : ""} Contact support if you believe this is a mistake.`
          : "This account is deactivated."
      );
    }

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    await recordAudit({ id: user.id, email: user.email }, "LOGIN_SUCCESS", "USER", user.id);
    return ok({
      id: user.id,
      name: user.name,
      role: user.role,
      redirect: ROLE_HOME[user.role] ?? "/dashboard",
    });
  } catch (err) {
    return handleError(err);
  }
}
