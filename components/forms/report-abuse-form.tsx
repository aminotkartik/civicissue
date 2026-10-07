"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const REASONS = [
  ["SPAM", "Spam or advertising"], ["OFFENSIVE", "Offensive or abusive content"], ["FALSE_INFO", "False or misleading information"], ["PII", "Exposes personal information"], ["FRAUD", "Fraudulent report"], ["OTHER", "Other concern"],
] as const;

export function ReportAbuseForm({ initialType = "ISSUE", initialId = "" }: { initialType?: "ISSUE" | "COMMENT" | "USER"; initialId?: string }) {
  const router = useRouter();
  const [entityType, setEntityType] = useState<"ISSUE" | "COMMENT" | "USER">(initialType);
  const [entityId, setEntityId] = useState(initialId);
  const [reasonType, setReasonType] = useState<(typeof REASONS)[number][0]>("OTHER");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    const routeId = entityType === "ISSUE" ? entityId.trim() : "report";
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(routeId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId: entityId.trim(), reasonType, details: details.trim() }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't send this report.");
      toast.success(data.message ?? "Thanks. Moderators will review this report.");
      setDetails("");
      router.push("/issues");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't send this report. Please try again.";
      setError(message); toast.error(message);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-alert-soft text-alert"><Flag className="h-5 w-5" aria-hidden /></span><div><h2 className="text-base font-bold text-ink">Report content for review</h2><p className="text-xs text-ink-muted">A moderator will review the content; this does not automatically remove it.</p></div></div>
      <div className="space-y-4">
        <Field label="Content type" required>{(id) => <Select id={id} value={entityType} onChange={(event) => setEntityType(event.target.value as typeof entityType)}><option value="ISSUE">Civic issue</option><option value="COMMENT">Comment</option><option value="USER">User account</option></Select>}</Field>
        <Field label={entityType === "ISSUE" ? "Public complaint ID" : entityType === "COMMENT" ? "Comment ID" : "User account ID"} required hint={entityType === "ISSUE" ? "Use the ID shown on the issue page, for example CIV-2026-000123." : "Use the content identifier from its report or moderation link."}>{(id) => <Input id={id} value={entityId} onChange={(event) => setEntityId(event.target.value)} required minLength={1} maxLength={128} placeholder={entityType === "ISSUE" ? "CIV-2026-000123" : "Paste identifier"} />}</Field>
        <Field label="Reason" required>{(id) => <Select id={id} value={reasonType} onChange={(event) => setReasonType(event.target.value as typeof reasonType)}>{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field>
        <Field label="Details" optional hint="Include only information that helps a moderator review the content; don't add private personal information.">{(id) => <Textarea id={id} value={details} onChange={(event) => setDetails(event.target.value)} rows={4} maxLength={1000} placeholder="What should the moderator know?" />}</Field>
        {error && <p className="rounded-lg bg-alert-soft px-3 py-2 text-xs font-medium text-alert" role="alert">{error}</p>}
        <div className="flex justify-end"><Button type="submit" variant="danger" loading={saving}><Flag className="h-4 w-4" aria-hidden /> Submit for review</Button></div>
      </div>
    </form>
  );
}
