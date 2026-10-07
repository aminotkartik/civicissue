import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getIssueDetail, publicCoordinates } from "@/lib/queries/issues";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { issues } from "@/drizzle/sqlite/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const viewer = await getCurrentUser();
    const detail = await getIssueDetail(id, viewer);
    if (!detail) return fail(404, "This complaint could not be found.");
    const publicCoords = publicCoordinates(detail.issue);
    const issue = detail.viewerState.canSeeExact
      ? detail.issue
      : {
          ...detail.issue,
          latitude: publicCoords.latitude,
          longitude: publicCoords.longitude,
          address: null,
        };
    return ok({
      ...detail,
      issue,
      statusHistory: detail.viewerState.canSeeStaffDetails || detail.viewerState.isReporter
        ? detail.statusHistory
        : [],
    });
  } catch (err) {
    return handleError(err);
  }
}

const editSchema = z.object({
  title: z.string().trim().min(8).max(120).optional(),
  description: z.string().trim().min(20).max(3000).optional(),
});

/** PATCH — reporter edits while SUBMITTED/DRAFT; staff with editAny anytime. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const viewer = await getCurrentUser();
    if (!viewer) return fail(401, "Please sign in to continue.");
    const detail = await getIssueDetail(id, viewer);
    if (!detail) return fail(404, "This complaint could not be found.");
    const isReporter = detail.issue.createdById === viewer.id;
    const canEditAny = viewer.role === "ADMIN";
    if (!isReporter && !canEditAny)
      return fail(403, "You don't have permission to edit this complaint.");
    if (isReporter && !canEditAny && !["DRAFT", "SUBMITTED"].includes(detail.issue.status))
      return fail(409, "Reports can only be edited before the authority starts reviewing them.");
    const body = editSchema.parse(await readJson(req));
    const db = await getDb();
    await db
      .update(issues)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(issues.id, detail.issue.id));
    await recordAudit({ id: viewer.id, email: viewer.email }, "ISSUE_EDITED", "ISSUE", detail.issue.id, body);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
