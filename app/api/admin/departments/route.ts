import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { departments } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Department name is required.").max(120),
  description: z.string().trim().max(600).optional().default(""),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  zones: z.string().trim().max(300).optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = schema.parse(await readJson(req));
    const db = await getDb();
    const now = new Date();
    if (body.id) {
      await db.update(departments).set({
        name: body.name,
        description: body.description || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        zones: body.zones || null,
        active: body.active ?? true,
        updatedAt: now,
      }).where(eq(departments.id, body.id));
      await recordAudit({ id: actor.id, email: actor.email }, "DEPARTMENT_UPDATED", "DEPARTMENT", body.id, { name: body.name });
      return ok({ id: body.id });
    }
    const id = uuid();
    await db.insert(departments).values({
      id,
      name: body.name,
      description: body.description || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      zones: body.zones || null,
    });
    await recordAudit({ id: actor.id, email: actor.email }, "DEPARTMENT_CREATED", "DEPARTMENT", id, { name: body.name });
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
