import { NextRequest } from "next/server";
import { mapQuerySchema } from "@/lib/validation";
import { listMapIssues } from "@/lib/queries/issues";
import { ok, handleError } from "@/lib/api/respond";
import type { IssueStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = mapQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const items = await listMapIssues({
      minLat: query.minLat,
      maxLat: query.maxLat,
      minLng: query.minLng,
      maxLng: query.maxLng,
      statuses: query.statuses
        ? (query.statuses.split(",").filter(Boolean) as IssueStatus[])
        : undefined,
      categorySlug: query.category || undefined,
      priority: query.priority,
      limit: query.limit,
    });
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
}
