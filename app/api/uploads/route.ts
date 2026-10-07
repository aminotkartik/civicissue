import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api/respond";
import { getStorage, validateUpload, ValidationError } from "@/lib/storage";
import { checkRateLimit, LIMITS, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/uploads — multipart form upload (field name: "file", optional
 * "kind": image|video). Returns { key, url } where key can be attached to an
 * issue via createIssue / resolveIssue imageKeys.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    checkRateLimit(`upload:${clientKey(req, user.id)}`, LIMITS.upload);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("No file was provided.");
    }
    const kind = (form.get("kind") as string) === "video" ? "video" : "image";
    const data = Buffer.from(await file.arrayBuffer());
    const { mimeType } = validateUpload(data, file.type, kind);

    const storage = getStorage();
    const stored = await storage.upload(data, {
      mimeType,
      folder: kind === "video" ? "videos" : "images",
    });
    return ok({ key: stored.url, url: stored.url, size: stored.size, mimeType: stored.mimeType }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
