"use client";

/**
 * Mobile-first action panel for the field worker assigned to a job
 * (spec §38–§39): start work → post progress (with photos) → resolve
 * with mandatory after-photo for HIGH/CRITICAL priority.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, HardHat, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea, Field } from "@/components/ui/input";
import { FileUploader, type UploadedFile } from "@/components/issues/file-uploader";
import type { IssueStatus, Priority } from "@/lib/types";

export function WorkerActions({
  publicId,
  status,
  priority,
}: {
  publicId: string;
  status: IssueStatus;
  priority: Priority;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  const canWork = ["ASSIGNED", "IN_PROGRESS", "REOPENED", "ESCALATED"].includes(status);

  async function startWork() {
    setBusy("start");
    try {
      const res = await fetch(`/api/issues/${publicId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", note: "Field work started" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't start the job.");
        return;
      }
      toast.success("Job started. Good luck out there — post updates as you go.");
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!canWork) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/60 p-4 text-center">
        <p className="text-[13px] font-medium text-ink-soft">
          {status === "RESOLVED" || status === "CLOSED"
            ? "This job is complete. The citizen has been asked for feedback."
            : "No active field task on this complaint right now."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" aria-label="Field worker actions">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-accent">
        <HardHat className="h-3.5 w-3.5" aria-hidden /> Your field task
      </p>
      {status === "ASSIGNED" && (
        <Button size="lg" className="w-full" onClick={startWork} loading={busy === "start"} disabled={busy !== null}>
          <Wrench className="h-4 w-4" aria-hidden /> Start work
        </Button>
      )}
      <Button variant="secondary" size="lg" className="w-full" onClick={() => setProgressOpen(true)} disabled={busy !== null}>
        Post progress update
      </Button>
      {status === "IN_PROGRESS" ? (
        <Button variant="success" size="lg" className="w-full" onClick={() => setResolveOpen(true)} disabled={busy !== null}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark as resolved
        </Button>
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-ink-muted">
          Start work before resolving — resolution is recorded from an in-progress job.
        </p>
      )}

      <ProgressModal open={progressOpen} onClose={() => setProgressOpen(false)} publicId={publicId} onDone={() => router.refresh()} />
      <WorkerResolveModal open={resolveOpen} onClose={() => setResolveOpen(false)} publicId={publicId} priority={priority} onDone={() => router.refresh()} />
    </div>
  );
}

function ProgressModal({
  open,
  onClose,
  publicId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  publicId: string;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const imageKeys = files.filter((f) => f.status === "done").map((f) => f.key);
      const res = await fetch(`/api/issues/${publicId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), imageKeys }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't post the update.");
        return;
      }
      toast.success("Progress posted. The citizen and followers were notified.");
      setMessage("");
      setFiles([]);
      onClose();
      onDone();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Post progress update"
      description="Keep the citizen informed — short, honest updates build trust.">
      <div className="space-y-4">
        <Field label="What's happening on site?" required>
          {(id) => (
            <Textarea id={id} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000}
              placeholder='e.g. "Milling machine on site, patching expected to finish by evening."' />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Progress photos <span className="text-xs font-normal text-ink-muted">(optional)</span></p>
          <FileUploader files={files} onChange={setFiles} max={4} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={loading} disabled={loading || message.trim().length < 5} onClick={submit}>Post update</Button>
        </div>
      </div>
    </Modal>
  );
}

function WorkerResolveModal({
  open,
  onClose,
  publicId,
  priority,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  publicId: string;
  priority: Priority;
  onDone: () => void;
}) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const imageKeys = files.filter((f) => f.status === "done").map((f) => f.key);
  const photoRequired = priority === "HIGH" || priority === "CRITICAL";

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${publicId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), imageKeys }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't resolve the job.");
        return;
      }
      toast.success("Job resolved! The citizen will be asked for feedback.");
      setDescription("");
      setFiles([]);
      onClose();
      onDone();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark job as resolved"
      description={photoRequired ? "High/critical priority jobs require at least one after photo." : "Attach an after photo so the citizen can verify the fix."}>
      <div className="space-y-4">
        <Field label="Resolution description" required hint="What exactly did you do? This goes on the public timeline.">
          {(id) => (
            <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500}
              placeholder='e.g. "Filled pothole with asphalt mix, compacted and levelled with road surface."' />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">
            After photos {photoRequired ? <span className="text-alert">*</span> : <span className="text-xs font-normal text-ink-muted">(recommended)</span>}
          </p>
          <FileUploader files={files} onChange={setFiles} max={4} />
        </div>
        {photoRequired && imageKeys.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-alert" role="alert">
            <X className="h-3.5 w-3.5" aria-hidden /> An after photo is required for {priority.toLowerCase()} priority jobs.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={loading}
            disabled={loading || description.trim().length < 15 || (photoRequired && imageKeys.length === 0)}
            onClick={submit}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Resolve job
          </Button>
        </div>
      </div>
    </Modal>
  );
}
