import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { profileSchema } from "@/lib/validation";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = profileSchema.parse(await readJson(req));
    const db = await getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      "name", "phone", "city", "locality", "bio", "profileImage",
      "prefEmail", "prefInApp", "prefStatusUpdates", "prefResolution", "prefCommunity",
    ] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    await db.update(users).set(patch).where(eq(users.id, user.id));
    await recordAudit({ id: user.id, email: user.email }, "PROFILE_UPDATED", "USER", user.id);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .regex(/[A-Z]/, "Password must include one uppercase letter.")
    .regex(/[a-z]/, "Password must include one lowercase letter.")
    .regex(/[0-9]/, "Password must include one number."),
});

/** PUT /api/users/me — change password (requires current password). */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = passwordSchema.parse(await readJson(req));
    const db = await getDb();
    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const record = rows[0];
    if (!record) return fail(404, "Account not found.");
    if (!record.passwordHash) {
      return fail(400, "This account uses Google sign-in and has no password yet.");
    }
    const valid = await verifyPassword(body.currentPassword, record.passwordHash);
    if (!valid) return fail(401, "Your current password is incorrect.");
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await recordAudit({ id: user.id, email: user.email }, "PASSWORD_CHANGED", "USER", user.id);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
