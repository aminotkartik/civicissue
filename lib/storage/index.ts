/**
 * File storage abstraction (spec: replaceable provider).
 *
 *  - "local": writes to STORAGE_LOCAL_DIR (default ./data/uploads) and files
 *    are served through /api/files/[...path] — the zero-config dev/demo mode.
 *  - "s3":   interface-compatible hook for any S3-compatible bucket
 *    (Supabase Storage, Cloudinary S3 API, AWS S3, MinIO). Configure the
 *    STORAGE_S3_* env vars and implement `S3Storage.upload` with the AWS SDK
 *    of your choice; the rest of the app is unaffected.
 *
 * Uploads are validated (MIME sniffing + size cap) before they reach storage.
 */
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredFile {
  /** Public URL path used in <img src> — relative for local storage. */
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(
    data: Buffer,
    opts: { mimeType: string; folder?: string; filenameHint?: string }
  ): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/** Sniffs the real content type from magic bytes (never trust the header). */
export function sniffMimeType(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return "image/jpeg";
  if (
    data.length >= 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  )
    return "image/png";
  if (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (data.length >= 6 && data.toString("ascii", 0, 3) === "GIF")
    return "image/gif";
  if (
    data.length >= 12 &&
    data.toString("ascii", 4, 8) === "ftyp"
  )
    return "video/mp4";
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3)
    return "video/webm";
  return null;
}

export class ValidationError extends Error {}

export function validateUpload(
  data: Buffer,
  declaredType: string,
  kind: "image" | "video" = "image"
): { mimeType: string } {
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (data.byteLength === 0) throw new ValidationError("The file is empty.");
  if (data.byteLength > max) {
    throw new ValidationError(
      kind === "image"
        ? "Image must be less than 10 MB."
        : "Video must be less than 50 MB."
    );
  }
  const sniffed = sniffMimeType(data);
  const allowed = kind === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  if (!sniffed || !allowed.includes(sniffed)) {
    throw new ValidationError(
      kind === "image"
        ? "Image must be JPG, PNG, WEBP or GIF and less than 10 MB."
        : "Video must be MP4 or WEBM and less than 50 MB."
    );
  }
  if (declaredType && !allowed.includes(declaredType) && !allowed.includes(sniffed)) {
    throw new ValidationError("Unsupported file type.");
  }
  return { mimeType: sniffed };
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

class LocalStorage implements StorageProvider {
  readonly name = "local";
  private dir: string;

  constructor(dir?: string) {
    this.dir = path.resolve(
      process.cwd(),
      dir ?? process.env.STORAGE_LOCAL_DIR ?? "./data/uploads"
    );
  }

  async upload(
    data: Buffer,
    opts: { mimeType: string; folder?: string }
  ): Promise<StoredFile> {
    const folder = (opts.folder ?? "misc").replace(/[^a-z0-9_-]/gi, "");
    const key = `${folder}/${randomUUID()}.${EXT[opts.mimeType] ?? "bin"}`;
    const full = path.join(this.dir, key);
    // Prevent path traversal.
    if (!full.startsWith(this.dir)) throw new ValidationError("Invalid path.");
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return {
      url: `/api/files/${key}`,
      key,
      size: data.byteLength,
      mimeType: opts.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const full = path.join(this.dir, key);
    if (!full.startsWith(this.dir)) return;
    try {
      await unlink(full);
    } catch {
      /* already gone */
    }
  }
}

/**
 * S3-compatible storage stub. Enable with STORAGE_PROVIDER=s3 and the
 * STORAGE_S3_* env vars; wire in @aws-sdk/client-s3 here. Kept isolated so
 * the rest of the app only ever sees the StorageProvider interface.
 */
class S3Storage implements StorageProvider {
  readonly name = "s3";
  async upload(): Promise<StoredFile> {
    throw new Error(
      "S3 storage is not wired in this deployment. Set STORAGE_PROVIDER=local or implement S3Storage.upload with @aws-sdk/client-s3."
    );
  }
  async delete(): Promise<void> {
    /* no-op */
  }
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;
  const kind = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  provider = kind === "s3" ? new S3Storage() : new LocalStorage();
  return provider;
}

export function storageLocalDir(): string {
  return path.resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR ?? "./data/uploads"
  );
}
