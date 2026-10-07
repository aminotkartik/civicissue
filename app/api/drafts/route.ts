import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { drafts } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const db = await getDb();
    const requestedId = new URL(req.url).searchParams.get("id");
    const where = requestedId
      ? and(eq(drafts.userId, user.id), eq(drafts.id, requestedId))
      : eq(drafts.userId, user.id);
    const rows = await db
      .select()
      .from(drafts)
      .where(where)
      .orderBy(desc(drafts.updatedAt))
      .limit(10);
    const owned = requestedId ? rows.filter((row) => row.id === requestedId) : rows;
    return ok({
      items: owned.map((r) => ({
        id: r.id,
        payload: JSON.parse(r.payload) as Record<string, unknown>,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).refine((p) => Object.keys(p).length < 40),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = saveSchema.parse(await readJson(req));
    const db = await getDb();
    const now = new Date();
    if (body.id) {
      // Scope both lookup and update by owner to prevent IDOR.
      const existing = await db
        .select({ id: drafts.id })
        .from(drafts)
        .where(and(eq(drafts.id, body.id), eq(drafts.userId, user.id)))
        .limit(1);
      if (!existing[0]) return fail(404, "Draft not found.");
      await db
        .update(drafts)
        .set({ payload: JSON.stringify(body.payload), updatedAt: now })
        .where(and(eq(drafts.id, body.id), eq(drafts.userId, user.id)));
      return ok({ id: body.id });
    }
    const id = uuid();
    await db.insert(drafts).values({
      id,
      userId: user.id,
      payload: JSON.stringify(body.payload),
    });
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return ok({ deleted: false });
    const db = await getDb();
    const existing = await db.select({ id: drafts.id, userId: drafts.userId }).from(drafts).where(eq(drafts.id, id)).limit(1);
    if (existing[0] && existing[0].userId === user.id) {
      await db.delete(drafts).where(eq(drafts.id, id));
    }
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
