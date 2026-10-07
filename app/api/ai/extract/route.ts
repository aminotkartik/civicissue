import { NextRequest } from "next/server";
import { z } from "zod";
import { extractFromVoiceOrText } from "@/lib/ai/classifier";
import { getActiveCategories } from "@/lib/queries/references";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  text: z.string().trim().min(10, "Please speak or type a full sentence about the problem.").max(4000),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    checkRateLimit(`ai:${clientKey(req, viewer?.id)}`, LIMITS.ai);
    const body = schema.parse(await readJson(req));
    const cats = await getActiveCategories();
    const result = await extractFromVoiceOrText(
      body.text,
      cats.map((c) => ({ slug: c.slug, name: c.name }))
    );
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
