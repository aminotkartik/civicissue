/**
 * Notification service (spec §32, §76).
 *
 * - In-app notifications always work (rows in the notifications table).
 * - Email is sent when EMAIL_PROVIDER is configured (Resend HTTP API);
 *   failures are logged and never break the calling action.
 * - Recipients' preferences (users.pref*) are respected.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, users } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import type { NotificationType } from "@/lib/types";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  issueId?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
  /** Send email too (respects user's prefEmail). */
  email?: boolean;
}

export async function notify(input: NotifyInput): Promise<void> {
  const db = await getDb();
  await db.insert(notifications).values({
    id: uuid(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    issueId: input.issueId ?? null,
    link: input.link ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
  if (input.email) {
    const rows = await db
      .select({ email: users.email, prefEmail: users.prefEmail })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    const target = rows[0];
    if (target?.prefEmail) {
      await sendEmail(target.email, input.title, input.message).catch((err) => {
        console.warn("[civicissue:email] send failed (non-fatal):", err);
      });
    }
  }
}

export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unique.map((userId) => notify({ ...input, userId })));
}

/** Email via Resend API when configured; logs otherwise. Never throws. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  const provider = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase();
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM ?? "CivicIssue <no-reply@civicissue.app>";
  if (provider !== "resend" || !apiKey) {
    console.info(`[civicissue:email] (not configured — would send) to=${to} subject="${subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.warn(`[civicissue:email] Resend HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[civicissue:email] delivery failed:", err);
    return false;
  }
}

export async function markAllRead(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}
