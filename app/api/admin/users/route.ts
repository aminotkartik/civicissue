import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { listUsersForAdmin, adminUpdateUser } from "@/lib/queries/users";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { USER_ROLES, type UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const url = new URL(req.url);
    const result = await listUsersForAdmin({
      q: url.searchParams.get("q") ?? undefined,
      role: (url.searchParams.get("role") as UserRole) ?? undefined,
      suspended: (url.searchParams.get("suspended") as "yes" | "no") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(USER_ROLES).optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().trim().max(300).optional(),
  departmentId: z.string().nullish(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const body = patchSchema.parse(await readJson(req));
    const { userId, ...patch } = body;
    await adminUpdateUser(actor, userId, patch);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
