"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils/format";

export interface AbuseReportView {
  id: string;
  entityType: "ISSUE" | "COMMENT" | "USER";
  entityId: string;
  reasonType: string;
  details: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  createdAt: Date | string;
  reporterName: string;
  targetTitle: string;
  targetLink: string | null;
  action: "NONE" | "HIDE_COMMENT" | "HIDE_ISSUE" | "RESTORE_COMMENT" | "RESTORE_ISSUE";
}

export interface AuditLogView {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date | string;
}

export function ModerationConsole({ reports, auditLogs }: { reports: AbuseReportView[]; auditLogs: AuditLogView[] }) {
  const [tab, setTab] = useState("PENDING");
  const filtered = tab === "ALL" ? reports : reports.filter((report) => report.status === tab);
  const pending = reports.filter((report) => report.status === "PENDING").length;
  return (
    <>
      <section aria-labelledby="moderation-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="moderation-title" className="text-lg font-bold text-ink">Abuse reports</h2><p className="mt-0.5 text-xs text-ink-muted">Review reported content and apply a visible hide/restore action where appropriate.</p></div><span className="rounded-full bg-alert-soft px-2.5 py-1 text-xs font-bold text-alert">{pending} pending</span></div>
        <Tabs value={tab} items={[{ key: "PENDING", label: "Pending", count: pending }, { key: "REVIEWED", label: "Reviewed", count: reports.filter((r) => r.status === "REVIEWED").length }, { key: "DISMISSED", label: "Dismissed", count: reports.filter((r) => r.status === "DISMISSED").length }, { key: "ALL", label: "All reports", count: reports.length }]} onChange={setTab} className="w-fit" />
        {filtered.length ? <div className="mt-4 space-y-3">{filtered.map((report) => <AbuseReportCard key={report.id} report={report} />)}</div> : <EmptyState className="mt-4" icon={<ShieldCheck className="h-6 w-6" aria-hidden />} title={tab === "PENDING" ? "No abuse reports waiting" : "No reports in this filter"} message="Reported content will appear here for review. All decisions are recorded in the audit log." />}
      </section>

      <section className="mt-10" aria-labelledby="audit-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="audit-title" className="text-lg font-bold text-ink">Audit log</h2><p className="mt-0.5 text-xs text-ink-muted">Recent administrative and lifecycle actions, newest first.</p></div><Link href="/api/admin/audit" className="text-xs font-semibold text-terra-700 hover:underline">Open audit API <ExternalLink className="inline h-3 w-3" aria-hidden /></Link></div>
        {auditLogs.length ? <div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left"><caption className="sr-only">Recent administrative audit events</caption><thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">When</th></tr></thead><tbody className="divide-y divide-line">{auditLogs.map((log) => <tr key={log.id}><td className="px-4 py-3"><span className="text-xs font-semibold text-ink">{log.action.replaceAll("_", " ").toLowerCase()}</span></td><td className="px-4 py-3 text-xs text-ink-soft">{log.actorEmail ?? "System"}</td><td className="max-w-52 truncate px-4 py-3 text-[11px] text-ink-muted">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</td><td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-muted">{formatDateTime(log.createdAt)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ink-muted">No audit events recorded yet.</p>}
      </section>
    </>
  );
}

function AbuseReportCard({ report }: { report: AbuseReportView }) {
  const router = useRouter();
  const [status, setStatus] = useState<"REVIEWED" | "DISMISSED">(report.status === "DISMISSED" ? "DISMISSED" : "REVIEWED");
  const [action, setAction] = useState<AbuseReportView["action"]>(report.action);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const actions: AbuseReportView["action"][] = report.entityType === "ISSUE"
    ? ["NONE", "HIDE_ISSUE", "RESTORE_ISSUE"]
    : report.entityType === "COMMENT"
      ? ["NONE", "HIDE_COMMENT", "RESTORE_COMMENT"]
      : ["NONE"];

  async function submit() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/abuse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.id, decision: status, action, note }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save moderation decision.");
      toast.success("Moderation decision recorded in audit log.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save moderation decision."); }
    finally { setSaving(false); }
  }

  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-alert-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-alert">{report.reasonType.replaceAll("_", " ")}</span><span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-muted">{report.entityType}</span><span className="text-[10px] text-ink-muted">Reported by {report.reporterName} · {formatDateTime(report.createdAt)}</span></div>
      {report.targetLink ? <Link href={report.targetLink} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink hover:text-terra-700">{report.targetTitle}<ExternalLink className="h-3 w-3" aria-hidden /></Link> : <p className="mt-2 text-sm font-semibold text-ink">{report.targetTitle}</p>}
      {report.details && <blockquote className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">“{report.details}”</blockquote>}
      {report.status !== "PENDING" ? <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-verdant"><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />{report.status === "REVIEWED" ? "Reviewed" : "Dismissed"}</p> : (
        <div className="mt-4 grid gap-2 sm:grid-cols-[130px_minmax(160px,1fr)_minmax(180px,1.2fr)_auto]">
          <Select value={status} onChange={(event) => setStatus(event.target.value as "REVIEWED" | "DISMISSED")} aria-label="Review decision"><option value="REVIEWED">Mark reviewed</option><option value="DISMISSED">Dismiss report</option></Select>
          <Select value={action} onChange={(event) => setAction(event.target.value as AbuseReportView["action"])} aria-label="Content moderation action">{actions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ").toLowerCase()}</option>)}</Select>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={1} className="min-h-10 py-2 text-xs" placeholder="Internal review note (optional)" aria-label="Internal review note" />
          <Button size="sm" loading={saving} onClick={() => void submit()}><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Save</Button>
        </div>
      )}
    </article>
  );
}
