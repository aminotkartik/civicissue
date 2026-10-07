"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Camera, GripVertical, ImagePlus, Loader2, Trash2, UploadCloud, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  key: string; // server URL/key returned by /api/uploads
  localPreview: string; // object URL for instant preview
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Multi-image uploader with preview, remove, drag-reorder and per-file
 * validation (spec §14). Uploads POST to /api/uploads as soon as files are
 * picked so submission is instant.
 */
export function FileUploader({
  files,
  onChange,
  max = 6,
  onAnalyze,
  analysisBusy,
}: {
  files: UploadedFile[];
  onChange: Dispatch<SetStateAction<UploadedFile[]>>;
  max?: number;
  /** Called with the first successfully uploaded image for AI analysis. */
  onAnalyze?: (file: { key: string; base64: string; mimeType: string }) => void;
  analysisBusy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, analyze: boolean) => {
      setGlobalError(null);
      if (!ACCEPTED.includes(file.type)) {
        setGlobalError("Image must be JPG, PNG or WEBP and less than 10 MB.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setGlobalError("Image must be JPG, PNG or WEBP and less than 10 MB.");
        return;
      }
      const localPreview = URL.createObjectURL(file);
      const temp: UploadedFile = {
        key: "",
        localPreview,
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 30,
      };
      onChange((prev) => [...prev, temp]);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "image");
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = (await res.json()) as { key?: string; error?: string };
        if (!res.ok || !data.key) throw new Error(data.error ?? "Upload failed");
        const done: UploadedFile = { ...temp, key: data.key, status: "done", progress: 100 };
        onChange((prev) => prev.map((f) => (f.localPreview === temp.localPreview ? done : f)));
        // AI image analysis on the first uploaded photo (optional assist).
        if (analyze && onAnalyze) {
          const base64 = await fileToBase64(file);
          onAnalyze({ key: data.key, base64, mimeType: file.type });
        }
      } catch (err) {
        const failed: UploadedFile = {
          ...temp,
          status: "error",
          error: err instanceof Error ? err.message : "The image couldn't be uploaded. Check your connection and try again.",
        };
        onChange((prev) => prev.map((f) => (f.localPreview === temp.localPreview ? failed : f)));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, onChange, onAnalyze]
  );

  const handleFiles = useCallback(
    (list: FileList | null, fromCamera = false) => {
      if (!list) return;
      const incoming = Array.from(list).slice(0, max - files.length);
      incoming.forEach((f, i) =>
        upload(f, i === 0 && files.length === 0 && !fromCamera)
      );
    },
    [files.length, max, upload]
  );

  const remove = (i: number) => {
    const f = files[i]!;
    if (f.localPreview) URL.revokeObjectURL(f.localPreview);
    onChange(files.filter((_, idx) => idx !== i));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed p-4 text-center transition-colors",
          dragOver ? "border-terra-400 bg-terra-50" : "border-line-strong bg-surface-2/40"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          aria-label="Upload evidence photos"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => { handleFiles(e.target.files, true); e.target.value = ""; }}
          aria-label="Take a photo"
        />
        <UploadCloud className="mx-auto h-7 w-7 text-ink-muted" aria-hidden />
        <p className="mt-2 text-sm font-medium text-ink">Drag photos here, or</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={files.length >= max}>
            <ImagePlus className="h-4 w-4" /> Upload images
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={files.length >= max}>
            <Camera className="h-4 w-4" /> Take photo
          </Button>
        </div>
        <p className="mt-2.5 text-[11px] text-ink-muted">
          JPG, PNG or WEBP · up to 10 MB each · {files.length}/{max} attached
          {onAnalyze && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-active">
              <Sparkles className="h-3 w-3" /> first photo gets an AI check
            </span>
          )}
        </p>
      </div>

      {globalError && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-alert" role="alert">
          <AlertCircle className="h-3.5 w-3.5" /> {globalError}
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Attached files">
          {files.map((f, i) => (
            <li
              key={f.localPreview || i}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-surface-2",
                f.status === "error" ? "border-alert" : "border-line"
              )}
            >
              <div className="relative aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.localPreview || f.key}
                  alt={f.name}
                  className={cn("h-full w-full object-cover", f.status === "uploading" && "opacity-60")}
                />
                {f.status === "uploading" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/20">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </span>
                )}
                {analysisBusy && i === 0 && f.status === "done" && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-active-soft px-2 py-0.5 text-[10px] font-semibold text-active">
                    <Sparkles className="h-3 w-3" /> Analyzing…
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30" aria-label={`Move ${f.name} earlier`}>
                    <GripVertical className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === files.length - 1} className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30" aria-label={`Move ${f.name} later`}>
                    <GripVertical className="h-3.5 w-3.5 rotate-90" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-ink-muted hover:bg-alert-soft hover:text-alert"
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {f.status === "error" && (
                <p className="px-2 pb-1.5 text-[10px] font-medium text-alert">{f.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
