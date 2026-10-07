import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { storageLocalDir } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
};

/** Serves locally stored uploads. Replaced by CDN/S3 URLs in production. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const rel = (segments ?? []).join("/");
  const base = storageLocalDir();
  const full = path.resolve(base, rel);
  if (!full.startsWith(base)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const data = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
