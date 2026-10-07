import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appSettings } from "@/drizzle/sqlite/schema";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_WEIGHTS } from "@/lib/priority/engine";
import { PLATFORM_DEFAULT_SLA_HOURS } from "@/lib/sla/engine";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const db = await getDb();
    const rows = await db.select().from(appSettings);
    const settings: Record<string, unknown> = {
      priority_weights: DEFAULT_WEIGHTS,
      sla_defaults: PLATFORM_DEFAULT_SLA_HOURS,
    };
    for (const r of rows) {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    }
    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}

const priorityWeightsSchema = z.object({
  severity: z.number().int().min(0).max(100),
  community: z.number().int().min(0).max(100),
  location: z.number().int().min(0).max(100),
  safety: z.number().int().min(0).max(100),
  duration: z.number().int().min(0).max(100),
  category: z.number().int().min(0).max(100),
}).refine((weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) === 100, "Priority weights must add up to 100.");

const slaDefaultsSchema = z.object({
  CRITICAL: z.number().int().min(1).max(720),
  HIGH: z.number().int().min(1).max(720),
  MEDIUM: z.number().int().min(1).max(2160),
  LOW: z.number().int().min(1).max(4320),
});

const putSchema = z.object({
  key: z.string().regex(/^[a-z_]{3,40}$/, "Setting key must be lowercase snake_case."),
  value: z.record(z.unknown()).or(z.number()).or(z.string()).or(z.boolean()),
}).superRefine((body, ctx) => {
  if (body.key === "priority_weights") {
    const result = priorityWeightsSchema.safeParse(body.value);
    if (!result.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error.issues[0]?.message ?? "Invalid priority weights." });
  }
  if (body.key === "sla_defaults") {
    const result = slaDefaultsSchema.safeParse(body.value);
    if (!result.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error.issues[0]?.message ?? "Invalid SLA defaults." });
  }
});

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = putSchema.parse(await readJson(req));
    const db = await getDb();
    await db
      .insert(appSettings)
      .values({ key: body.key, value: JSON.stringify(body.value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: JSON.stringify(body.value), updatedAt: new Date() },
      });
    await recordAudit({ id: actor.id, email: actor.email }, "SETTING_UPDATED", "SETTINGS", body.key, { value: body.value });
    return ok({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
