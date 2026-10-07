import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb, withTransaction } from "@/lib/db";
import { departments, workers, users } from "@/drizzle/sqlite/schema";
import { uuid } from "@/lib/ids";
import { hashPassword } from "@/lib/auth";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const db = await getDb();
    const items = await db
      .select({
        id: workers.id,
        userId: workers.userId,
        name: users.name,
        email: users.email,
        employeeId: workers.employeeId,
        departmentId: workers.departmentId,
        departmentName: departments.name,
        zone: workers.zone,
        phone: workers.phone,
        active: workers.active,
      })
      .from(workers)
      .innerJoin(users, eq(workers.userId, users.id))
      .innerJoin(departments, eq(workers.departmentId, departments.id))
      .orderBy(desc(workers.createdAt));
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  temporaryPassword: z.string().min(8).max(100),
  employeeId: z.string().trim().min(2).max(30),
  departmentId: z.string().min(1),
  zone: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(20).optional().default(""),
});

/** POST — create a field-worker account + worker record atomically. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = createSchema.parse(await readJson(req));
    const db = await getDb();
    const department = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, body.departmentId), eq(departments.active, true))).limit(1);
    if (!department[0]) return fail(400, "Choose an active department.");
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
    if (existing[0]) return fail(409, "A user with this email already exists.");
    const userId = uuid();
    const workerId = uuid();
    await withTransaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.temporaryPassword),
        role: "WORKER",
        phone: body.phone || null,
        city: "",
        departmentId: body.departmentId,
      });
      await tx.insert(workers).values({
        id: workerId,
        userId,
        employeeId: body.employeeId,
        departmentId: body.departmentId,
        zone: body.zone || null,
        phone: body.phone || null,
      });
    });
    await recordAudit({ id: actor.id, email: actor.email }, "WORKER_CREATED", "WORKER", workerId, {
      email: body.email,
      employeeId: body.employeeId,
    });
    return ok({ id: workerId, userId }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  departmentId: z.string().min(1).optional(),
  zone: z.string().nullish(),
});

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = patchSchema.parse(await readJson(req));
    const db = await getDb();
    const rows = await db.select().from(workers).where(eq(workers.id, body.id)).limit(1);
    const worker = rows[0];
    if (!worker) return fail(404, "Worker not found.");
    if (body.departmentId) {
      const department = await db.select({ id: departments.id }).from(departments)
        .where(and(eq(departments.id, body.departmentId), eq(departments.active, true))).limit(1);
      if (!department[0]) return fail(400, "Choose an active department.");
    }
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.active !== undefined) set.active = body.active;
    if (body.departmentId) set.departmentId = body.departmentId;
    if (body.zone !== undefined) set.zone = body.zone || null;
    await withTransaction(async (tx) => {
      await tx.update(workers).set(set).where(eq(workers.id, body.id));
      const userPatch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.active !== undefined) userPatch.isActive = body.active;
      if (body.departmentId) userPatch.departmentId = body.departmentId;
      if (Object.keys(userPatch).length > 1) await tx.update(users).set(userPatch).where(eq(users.id, worker.userId));
    });
    await recordAudit({ id: actor.id, email: actor.email }, "WORKER_UPDATED", "WORKER", body.id, set);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
