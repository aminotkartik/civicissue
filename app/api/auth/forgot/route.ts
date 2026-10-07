import { NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, passwordResets } from "@/drizzle/sqlite/schema";
import { forgotPasswordSchema } from "@/lib/validation";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { sendEmail } from "@/lib/notifications";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { uuid } from "@/lib/ids";

export const runtime = "nodejs";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await readJson(req));
    checkRateLimit(`pwreset:${clientKey(req)}:${body.email}`, LIMITS.passwordReset);

    const db = await getDb();
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);
    const user = rows[0];

    // Always respond identically — never reveal registration state.
    const generic = {
      message:
        "If an account exists for this email, a password reset link is on its way. The link expires in 30 minutes.",
    };
    if (!user) return ok(generic);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.insert(passwordResets).values({
      id: uuid(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${appUrl}/reset-password?token=${token}`;
    const sent = await sendEmail(
      user.email,
      "Reset your CivicIssue password",
      `Hi ${user.name},\n\nWe received a request to reset your CivicIssue password.\n\nReset link: ${link}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`
    );

    // Development/demo convenience: when no email provider is configured,
    // return the link so the flow can be demonstrated. Never in production.
    if (!sent && process.env.NODE_ENV !== "production") {
      return ok({ ...generic, devResetLink: link });
    }
    return ok(generic);
  } catch (err) {
    return handleError(err);
  }
}
