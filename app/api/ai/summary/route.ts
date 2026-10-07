import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { summarizeIssue } from "@/lib/ai/summarizer";
import { getIssueDetail } from "@/lib/queries/issues";
import { ok, fail, handleError } from "@/lib/api/respond";
import { can } from "@/lib/permissions/matrix";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
) {
  try {
    const user = await requireUser();
    if (!can(user.role, "authority:viewDepartmentQueue") && user.role !== "ADMIN") {
      return fail(403, "Summaries are available to authority staff and admins.");
    }
    checkRateLimit(`ai:${clientKey(req, user.id)}`, LIMITS.ai);
    const publicId = new URL(req.url).searchParams.get("id");
    if (!publicId) return fail(400, "Missing issue id.");
    const detail = await getIssueDetail(publicId, user);
    if (!detail) return fail(404, "This complaint could not be found.");
    const result = await summarizeIssue({
      publicId: detail.issue.publicId,
      title: detail.issue.title,
      description: detail.issue.description,
      categoryName: detail.category.name,
      status: detail.issue.status,
      priority: detail.issue.priority,
      locality: detail.issue.locality,
      timeline: detail.events.map((e) => ({
        message: e.message,
        createdAt: e.createdAt,
        actorRole: e.actorRole,
      })),
      upvotes: detail.issue.upvotesCount,
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
