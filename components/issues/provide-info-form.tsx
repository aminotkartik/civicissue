"use client";

/**
 * Reporter response when the authority requests more information
 * (spec §42): message + optional photos, moves the issue forward.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Field } from "@/components/ui/input";
import { FileUploader, type UploadedFile } from "@/components/issues/file-uploader";

export function ProvideInfoForm({
  publicId,
  request,
}: {
  publicId: string;
  request: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const imageKeys = files.filter((f) => f.status === "done").map((f) => f.key);
      const res = await fetch(`/api/issues/${publicId}/provide-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), imageKeys }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't send your response.");
        return;
      }
      toast.success("Information sent. The authority has been notified.");
      setMessage("");
      setFiles([]);
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-accent/40 bg-amber-soft/60 p-5" aria-labelledby="provide-info-heading">
      <h3 id="provide-info-heading" className="text-sm font-bold text-ink">
        The authority needs more information
      </h3>
      <blockquote className="mt-2 rounded-lg border-l-4 border-amber-accent bg-surface/70 px-3.5 py-2.5 text-[13px] italic leading-relaxed text-ink-soft">
        “{request}”
      </blockquote>
      <div className="mt-3.5 space-y-3.5">
        <Field label="Your response" required>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1500}
              placeholder="Answer their question and add anything else that helps…"
            />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">
            Additional photos <span className="text-xs font-normal text-ink-muted">(optional)</span>
          </p>
          <FileUploader files={files} onChange={setFiles} max={4} />
        </div>
        <Button className="w-full sm:w-auto" onClick={submit} loading={loading} disabled={loading || message.trim().length < 10}>
          <Send className="h-4 w-4" aria-hidden /> Send information
        </Button>
      </div>
    </div>
  );
}
