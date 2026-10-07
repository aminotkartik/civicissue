import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifications } from "@/drizzle/sqlite/schema";
import { markAllRead } from "@/lib/notifications";
import { ok, handleError, readJson } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const db = await getDb();

    const where = unreadOnly
      ? and(eq(notifications.userId, user.id), eq(notifications.isRead, false))
      : eq(notifications.userId, user.id);

    const items = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(60);

    const unreadRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return ok({ items, unread: unreadRows[0]?.n ?? 0 });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z
  .object({
    id: z.string().min(1).optional(),
    read: z.boolean().optional(),
    markAllRead: z.boolean().optional(),
  })
  .refine((b) => b.markAllRead || b.id !== undefined, {
    message: "Provide a notification id or markAllRead.",
  });

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await readJson(req));
    const db = await getDb();

    if (body.markAllRead) {
      await markAllRead(user.id);
      return ok({ updated: "all" });
    }
    // Ownership enforced in the WHERE clause — users can only touch their own.
    await db
      .update(notifications)
      .set({ isRead: body.read ?? true })
      .where(and(eq(notifications.id, body.id!), eq(notifications.userId, user.id)));
    return ok({ updated: body.id });
  } catch (err) {
    return handleError(err);
  }
}
