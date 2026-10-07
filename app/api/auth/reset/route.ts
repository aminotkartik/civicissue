import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { passwordResets, users } from "@/drizzle/sqlite/schema";
import { resetPasswordSchema } from "@/lib/validation";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await readJson(req));
    const db = await getDb();
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const rows = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          isNull(passwordResets.usedAt)
        )
      )
      .limit(1);
    const reset = rows[0];
    if (!reset || reset.expiresAt.getTime() < Date.now()) {
      return fail(400, "This reset link is invalid or has expired. Please request a new one.");
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() })
      .where(eq(users.id, reset.userId));
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, reset.id));
    await recordAudit({ id: reset.userId, email: null }, "PASSWORD_RESET", "USER", reset.userId);
    return ok({ message: "Your password has been reset. You can now log in." });
  } catch (err) {
    return handleError(err);
  }
}
