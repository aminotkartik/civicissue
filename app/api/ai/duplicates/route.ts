import { NextRequest } from "next/server";
import { z } from "zod";
import { findDuplicateCandidates } from "@/lib/ai/duplicateDetector";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { coordinateSchema } from "@/lib/validation";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().max(200),
  description: z.string().trim().max(4000),
  categorySlug: z.string().trim().min(1),
  ...coordinateSchema.shape,
  radiusKm: z.number().min(0.25).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    checkRateLimit(`ai:${clientKey(req, viewer?.id)}`, LIMITS.ai);
    const body = schema.parse(await readJson(req));
    const result = await findDuplicateCandidates(body);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
