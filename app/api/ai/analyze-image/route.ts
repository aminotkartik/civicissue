import { NextRequest } from "next/server";
import { z } from "zod";
import { analyzeImage } from "@/lib/ai/classifier";
import { ok, fail, handleError, readJson } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  /** data URL or plain base64 of an already-validated image */
  imageBase64: z.string().min(100).max(12_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    if (!viewer) return fail(401, "Please sign in to continue.");
    checkRateLimit(`ai-img:${clientKey(req, viewer.id)}`, LIMITS.ai);
    const body = schema.parse(await readJson(req));
    const base64 = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const result = await analyzeImage(base64, body.mimeType);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
