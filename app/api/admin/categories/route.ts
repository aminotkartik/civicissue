import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional().default(""),
  icon: z.string().trim().max(40).optional().default("cone"),
  defaultDepartmentId: z.string().nullish(),
  slaCriticalHours: z.number().int().min(1).max(720).optional(),
  slaHighHours: z.number().int().min(1).max(720).optional(),
  slaMediumHours: z.number().int().min(1).max(2160).optional(),
  slaLowHours: z.number().int().min(1).max(4320).optional(),
  active: z.boolean().optional(),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = schema.parse(await readJson(req));
    const db = await getDb();
    const now = new Date();
    if (body.id) {
      await db.update(categories).set({
        name: body.name,
        description: body.description || null,
        icon: body.icon || "cone",
        defaultDepartmentId: body.defaultDepartmentId || null,
        ...(body.slaCriticalHours ? { slaCriticalHours: body.slaCriticalHours } : {}),
        ...(body.slaHighHours ? { slaHighHours: body.slaHighHours } : {}),
        ...(body.slaMediumHours ? { slaMediumHours: body.slaMediumHours } : {}),
        ...(body.slaLowHours ? { slaLowHours: body.slaLowHours } : {}),
        active: body.active ?? true,
        updatedAt: now,
      }).where(eq(categories.id, body.id));
      await recordAudit({ id: actor.id, email: actor.email }, "CATEGORY_UPDATED", "CATEGORY", body.id, { name: body.name });
      return ok({ id: body.id });
    }
    const id = uuid();
    await db.insert(categories).values({
      id,
      name: body.name,
      slug: slugify(body.name),
      description: body.description || null,
      icon: body.icon || "cone",
      defaultDepartmentId: body.defaultDepartmentId || null,
      ...(body.slaCriticalHours ? { slaCriticalHours: body.slaCriticalHours } : {}),
      ...(body.slaHighHours ? { slaHighHours: body.slaHighHours } : {}),
      ...(body.slaMediumHours ? { slaMediumHours: body.slaMediumHours } : {}),
      ...(body.slaLowHours ? { slaLowHours: body.slaLowHours } : {}),
    });
    await recordAudit({ id: actor.id, email: actor.email }, "CATEGORY_CREATED", "CATEGORY", id, { name: body.name });
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
