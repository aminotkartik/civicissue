import { NextRequest } from "next/server";
import { nearbyQuerySchema } from "@/lib/validation";
import { listNearby } from "@/lib/queries/issues";
import { ok, handleError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = nearbyQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const items = await listNearby(query.latitude, query.longitude, query.radiusKm, query.limit);
    return ok({ items, radiusKm: query.radiusKm });
  } catch (err) {
    return handleError(err);
  }
}
