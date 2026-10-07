import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/api/respond";
import { postProgressUpdate } from "@/lib/queries/issue-actions";
export const runtime = "nodejs";

const progressSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, "Describe what progress has been made.")
    .max(1000),
  imageKeys: z.array(z.string().trim().min(1)).max(4).default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = progressSchema.parse(await readJson(req));
    await postProgressUpdate(id, user, body);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
