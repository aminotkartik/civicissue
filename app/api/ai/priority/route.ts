import { NextRequest } from "next/server";
import { z } from "zod";
import { computePriority } from "@/lib/priority/engine";
import { getPriorityWeights } from "@/lib/queries/settings";
import { getCategoryBySlug } from "@/lib/queries/references";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { PRIORITY_LEVELS } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(4000),
  categorySlug: z.string().trim().min(1),
  severity: z.enum(PRIORITY_LEVELS),
  upvotes: z.number().int().min(0).max(100000).default(0),
});

/** Deterministic priority preview shown in the report wizard review step. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await readJson(req));
    await getCategoryBySlug(body.categorySlug); // validates slug exists
    const weights = await getPriorityWeights();
    const result = computePriority({
      severity: body.severity,
      categorySlug: body.categorySlug,
      title: body.title,
      description: body.description,
      upvotes: body.upvotes,
      weights,
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
