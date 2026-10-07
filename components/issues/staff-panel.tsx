"use client";

/**
 * Authority / admin action panel on the issue detail page (spec §34–§45).
 * Every action goes through the server, which re-checks permissions, the
 * status machine, SLA rules and audit logging.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  FilePlus2,
  Gavel,
  Merge,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCog,
  XCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Textarea, Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileUploader, type UploadedFile } from "@/components/issues/file-uploader";
import { REJECTION_REASON_LABELS } from "@/lib/status/machine";
import type { IssueStatus, Priority } from "@/lib/types";

interface Dept { id: string; name: string }
interface Worker { id: string; name: string; employeeId: string; departmentId: string; assigned: number; inProgress: number; overdue: number }

export function StaffPanel({
  publicId,
  status,
  priority,
  role,
  departments,
  workers,
  currentDepartmentId,
  currentWorkerId,
}: {
  publicId: string;
  status: IssueStatus;
  priority: Priority;
  role: "AUTHORITY" | "ADMIN" | "WORKER";
  departments: Dept[];
  workers: Worker[];
  currentDepartmentId: string | null;
  currentWorkerId: string | null;
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<null | "verify" | "reject" | "assign" | "info" | "priority" | "escalate" | "merge" | "resolve">(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [summary, setSummary] = useState<{ text: string; isFallback: boolean } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function api(path: string, body?: unknown, method = "POST") {
    const res = await fetch(`/api/issues/${publicId}/${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data: data as { error?: string } };
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/ai/summary?id=${encodeURIComponent(publicId)}`);
      const data = (await res.json()) as { summary?: string; isFallback?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't generate the summary.");
        return;
      }
      setSummary({ text: data.summary ?? "", isFallback: !!data.isFallback });
    } catch {
      toast.error("AI assistance is temporarily unavailable. You can continue manually.");
    } finally {
      setSummaryLoading(false);
    }
  }

  const canManage = role === "AUTHORITY" || role === "ADMIN";

  const nextSteps = useMemo(() => {
    switch (status) {
      case "SUBMITTED":
      case "UNDER_REVIEW":
      case "WAITING_FOR_INFORMATION":
        return "Review the evidence, then verify or reject the report.";
      case "VERIFIED":
        return "Assign a department and field worker to start work.";
      case "ASSIGNED":
        return "Work should start soon — check SLA and escalate if stalled.";
      case "IN_PROGRESS":
        return "Monitor progress; the field team uploads resolution evidence.";
      case "ESCALATED":
        return "Re-assign with senior attention or adjust the priority.";
      case "REOPENED":
        return "Re-assign the job — the citizen says the problem persists.";
      case "RESOLVED":
        return "Check evidence and citizen feedback, then close the issue.";
      case "REJECTED":
        return "Rejected — can be restored to review if it was a mistake.";
      default:
        return "No pending action for this status.";
    }
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-info/25 bg-info-soft/70 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-info">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Staff workspace
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">What to do now:</strong> {nextSteps}
        </p>
        {canManage && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={loadSummary} loading={summaryLoading}>
            {!summaryLoading && <Sparkles className="h-3.5 w-3.5" aria-hidden />} AI case summary
          </Button>
        )}
        {summary && (
          <div className="mt-2.5 rounded-lg border border-line bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-active">
              <Sparkles className="h-3 w-3" aria-hidden />
              {summary.isFallback ? "Generated summary (template)" : "AI-generated analysis"}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{summary.text}</p>
          </div>
        )}
      </div>

      {canManage && (
        <div className="grid grid-cols-2 gap-2">
          {["SUBMITTED", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "REJECTED"].includes(status) && (
            <Button variant="success" onClick={() => setOpenModal("verify")}>
              <BadgeCheck className="h-4 w-4" aria-hidden /> Verify
            </Button>
          )}
          {!["REJECTED", "CLOSED", "RESOLVED"].includes(status) && (
            <Button variant="danger" onClick={() => setOpenModal("reject")}>
              <XCircle className="h-4 w-4" aria-hidden /> Reject
            </Button>
          )}
          {["VERIFIED", "ASSIGNED", "REOPENED", "ESCALATED", "UNDER_REVIEW"].includes(status) && (
            <Button variant="primary" className="col-span-2" onClick={() => setOpenModal("assign")}>
              <UserCog className="h-4 w-4" aria-hidden /> Assign department / worker
            </Button>
          )}
          {["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS"].includes(status) && (
            <Button variant="secondary" onClick={() => setOpenModal("info")}>
              <FilePlus2 className="h-4 w-4" aria-hidden /> Request info
            </Button>
          )}
          <Button variant="secondary" onClick={() => setOpenModal("priority")}>
            <TrendingUp className="h-4 w-4" aria-hidden /> Set priority
          </Button>
          {status === "IN_PROGRESS" && (
            <Button variant="success" className="col-span-2" onClick={() => setOpenModal("resolve")}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Mark resolved (with evidence)
            </Button>
          )}
          {!["ESCALATED", "RESOLVED", "CLOSED", "REJECTED"].includes(status) && (
            <Button variant="outline" onClick={() => setOpenModal("escalate")}>
              <Gavel className="h-4 w-4" aria-hidden /> Escalate
            </Button>
          )}
          {["VERIFIED", "ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(status) && (
            <Button variant="outline" onClick={() => setOpenModal("merge")}>
              <Merge className="h-4 w-4" aria-hidden /> Merge duplicate
            </Button>
          )}
          {status === "RESOLVED" && (
            <Button variant="secondary" className="col-span-2" onClick={() => setConfirmClose(true)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Close issue
            </Button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ modals */}
      <VerifyModal open={openModal === "verify"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <RejectModal open={openModal === "reject"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <AssignModal open={openModal === "assign"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} departments={departments} workers={workers} currentDepartmentId={currentDepartmentId} currentWorkerId={currentWorkerId} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <InfoModal open={openModal === "info"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <PriorityModal open={openModal === "priority"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} current={priority} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <EscalateModal open={openModal === "escalate"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <MergeModal open={openModal === "merge"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />
      <ResolveModal open={openModal === "resolve"} onClose={() => setOpenModal(null)} publicId={publicId} api={api} priority={priority} onDone={() => { setOpenModal(null); router.refresh(); }} busy={busy} setBusy={setBusy} />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={async () => {
          setBusy(true);
          const r = await api("close", { note: "Closed after resolution confirmation" });
          setBusy(false);
          if (r.ok) {
            toast.success("Issue closed.");
            setConfirmClose(false);
            router.refresh();
          } else toast.error(r.data.error ?? "Couldn't close the issue.");
        }}
        title="Close issue?"
        message="Closing archives this complaint as successfully resolved. The citizen is notified and can still reopen it if the problem returns."
        confirmLabel="Close issue"
        tone="primary"
        loading={busy}
      />
    </div>
  );
}

type ApiFn = (path: string, body?: unknown, method?: string) => Promise<{ ok: boolean; data: { error?: string } }>;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  publicId: string;
  api: ApiFn;
  onDone: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}

function useAction(api: ApiFn, path: string, onDone: () => void, setBusy: (b: boolean) => void, success: string) {
  return async (body?: unknown) => {
    setBusy(true);
    const r = await api(path, body);
    setBusy(false);
    if (r.ok) {
      toast.success(success);
      onDone();
    } else {
      toast.error(r.data.error ?? "The action couldn't be completed.");
    }
    return r.ok;
  };
}

function VerifyModal({ open, onClose, publicId, api, onDone, busy, setBusy }: ModalProps) {
  const [note, setNote] = useState("");
  const act = useAction(api, "verify", onDone, setBusy, "Report verified. The citizen has been notified.");
  return (
    <Modal open={open} onClose={onClose} title={`Verify ${publicId}?`} size="sm"
      description="Confirm the report appears legitimate based on the evidence.">
      <div className="space-y-4">
        <Field label="Verification note" optional>
          {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Photo evidence matches ward inspection record." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={busy} disabled={busy} onClick={() => void act({ note })}>
            <BadgeCheck className="h-4 w-4" aria-hidden /> Verify report
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({ open, onClose, publicId, api, onDone, busy, setBusy }: ModalProps) {
  const [reason, setReason] = useState("INSUFFICIENT_INFORMATION");
  const [note, setNote] = useState("");
  const act = useAction(api, "reject", onDone, setBusy, "Report rejected with reason. The citizen has been notified.");
  return (
    <Modal open={open} onClose={onClose} title={`Reject ${publicId}?`} size="sm"
      description="Rejections always include a reason — never silently reject a report.">
      <div className="space-y-4">
        <Field label="Rejection reason" required>
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(REJECTION_REASON_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Explain to the citizen" optional hint="Shown on the issue timeline and in the notification.">
          {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={busy} onClick={() => void act({ reason, note })}>
            <XCircle className="h-4 w-4" aria-hidden /> Reject report
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ open, onClose, api, onDone, busy, setBusy, departments, workers, currentDepartmentId, currentWorkerId }: ModalProps & {
  departments: Dept[];
  workers: Worker[];
  currentDepartmentId: string | null;
  currentWorkerId: string | null;
}) {
  const [departmentId, setDepartmentId] = useState(currentDepartmentId ?? "");
  const [workerId, setWorkerId] = useState(currentWorkerId ?? "");
  const [note, setNote] = useState("");
  const act = useAction(api, "assign", onDone, setBusy, "Assignment updated. The worker and citizen have been notified.");
  const deptWorkers = useMemo(
    () => workers.filter((w) => !departmentId || w.departmentId === departmentId),
    [workers, departmentId]
  );
  return (
    <Modal open={open} onClose={onClose} title="Assign responsibility" description="Route the issue to a department and, optionally, a specific field worker.">
      <div className="space-y-4">
        <Field label="Department" hint="Workload-aware: workers show their current open jobs.">
          {(id) => (
            <Select id={id} value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setWorkerId(""); }}>
              <option value="">— Keep unassigned —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Field worker" optional>
          {(id) => (
            <Select id={id} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">— No specific worker —</option>
              {deptWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.employeeId}) — {w.assigned} assigned, {w.inProgress} in progress{w.overdue ? `, ${w.overdue} overdue` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Assignment note" optional>
          {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Coordinate with the drainage team on site." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={busy || (!departmentId && !workerId)} onClick={() => void act({ departmentId: departmentId || null, workerId: workerId || null, note })}>
            <Send className="h-4 w-4" aria-hidden /> Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function InfoModal({ open, onClose, api, onDone, busy, setBusy }: ModalProps) {
  const [message, setMessage] = useState("");
  const act = useAction(api, "request-info", onDone, setBusy, "Information requested. The citizen has been notified.");
  return (
    <Modal open={open} onClose={onClose} title="Request more information" size="sm"
      description="The issue moves to “Waiting for Information” until the citizen responds.">
      <div className="space-y-4">
        <Field label="What do you need?" required hint="Be specific — e.g. “a clearer photo showing the full road section”.">
          {(id) => <Textarea id={id} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={800} placeholder="Please upload a clearer photograph showing the full road section." />}
        </Field>
        {message.trim().length > 0 && message.trim().length < 15 && (
          <p className="text-xs font-medium text-alert" role="alert">Tell the citizen exactly what information is needed (at least 15 characters).</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={busy || message.trim().length < 15} onClick={() => void act({ message: message.trim() })}>
            <Send className="h-4 w-4" aria-hidden /> Send request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PriorityModal({ open, onClose, api, onDone, busy, setBusy, current }: ModalProps & { current: Priority }) {
  const [priority, setPriority] = useState<Priority>(current);
  const [reason, setReason] = useState("");
  const act = useAction(api, "priority", onDone, setBusy, "Priority updated and SLA recalculated.");
  return (
    <Modal open={open} onClose={onClose} title="Adjust priority" size="sm"
      description="Manual overrides require an explanation and recalculate the SLA deadline.">
      <div className="space-y-4">
        <Field label="New priority" required>
          {(id) => (
            <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]).map((p) => (
                <option key={p} value={p}>● {p}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Why?" required hint="Recorded on the public timeline and audit log.">
          {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. School zone with heavy child footfall during peak hours." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={busy || reason.trim().length < 5} onClick={() => void act({ priority, reason: reason.trim() })}>
            <TrendingUp className="h-4 w-4" aria-hidden /> Update priority
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EscalateModal({ open, onClose, api, onDone, busy, setBusy }: ModalProps) {
  const [reason, setReason] = useState("");
  const act = useAction(api, "escalate", onDone, setBusy, "Issue escalated. Senior staff and admins have been notified.");
  return (
    <Modal open={open} onClose={onClose} title="Escalate this issue?" size="sm"
      description="Escalation alerts senior authority staff and flags the issue for priority attention.">
      <div className="space-y-4">
        <Field label="Escalation reason" optional>
          {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. No progress for 6 days despite two follow-ups." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={busy} onClick={() => void act({ reason: reason.trim() || undefined })}>
            <Gavel className="h-4 w-4" aria-hidden /> Escalate
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MergeModal({ open, onClose, publicId, api, onDone, busy, setBusy }: ModalProps) {
  const [target, setTarget] = useState("");
  const act = useAction(api, "merge", onDone, setBusy, "Duplicate merged. Both reporters have been notified.");
  const valid = /^CIV-\d{4}-\d{6}$/i.test(target.trim());
  return (
    <Modal open={open} onClose={onClose} title="Merge duplicate report" size="sm"
      description={`This report (${publicId}) will be closed and merged into the canonical issue. History is preserved and supporters are carried over.`}>
      <div className="space-y-4">
        <Field label="Canonical complaint ID" required error={target && !valid ? "Enter a valid ID like CIV-2026-000123." : null}>
          {(id) => <Input id={id} value={target} onChange={(e) => setTarget(e.target.value.toUpperCase())} placeholder="CIV-2026-000123" className="font-mono" />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={busy || !valid} onClick={() => void act({ canonicalPublicId: target.trim() })}>
            <Merge className="h-4 w-4" aria-hidden /> Merge into canonical
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResolveModal({ open, onClose, api, onDone, busy, setBusy, priority }: ModalProps & { priority: Priority }) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const act = useAction(api, "resolve", onDone, setBusy, "Issue marked resolved. The citizen has been asked for feedback.");
  const imageKeys = files.filter((f) => f.status === "done").map((f) => f.key);
  const photoRequired = priority === "HIGH" || priority === "CRITICAL";
  return (
    <Modal open={open} onClose={onClose} title="Mark issue as resolved"
      description={photoRequired ? "High and critical priority issues require at least one after photo." : "Attach an after photo so the citizen can verify the fix."}>
      <div className="space-y-4">
        <Field label="Resolution description" required hint="What exactly was done? This appears on the public timeline.">
          {(id) => (
            <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500}
              placeholder='e.g. "Pothole repaired and road surface restored with fresh asphalt."' />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">
            Resolution evidence {photoRequired ? <span className="text-alert">*</span> : <span className="text-xs text-ink-muted">(recommended)</span>}
          </p>
          <FileUploader files={files} onChange={setFiles} max={4} />
        </div>
        {photoRequired && imageKeys.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-alert" role="alert">
            <X className="h-3.5 w-3.5" aria-hidden /> An after photo is required for {priority.toLowerCase()} priority resolutions.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={busy} disabled={busy || description.trim().length < 15 || (photoRequired && imageKeys.length === 0)}
            onClick={() => void act({ description: description.trim(), imageKeys })}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Resolve issue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
