"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils/format";

const BUCKETS = {
  all: "",
  review: "SUBMITTED,UNDER_REVIEW,VERIFIED,WAITING_FOR_INFORMATION",
  progress: "ASSIGNED,IN_PROGRESS,REOPENED,ESCALATED",
  resolved: "RESOLVED,CLOSED",
  rejected: "REJECTED",
} as const;

export function MyReportsTabs({ counts }: { counts: Record<keyof typeof BUCKETS, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = Object.entries(BUCKETS).find(([, statuses]) => (params.get("statuses") ?? "") === statuses)?.[0] ?? "all";
  return (
    <Tabs
      value={active}
      items={[
        { key: "all", label: "All reports", count: counts.all },
        { key: "review", label: "Under review", count: counts.review },
        { key: "progress", label: "In progress", count: counts.progress },
        { key: "resolved", label: "Resolved", count: counts.resolved },
        { key: "rejected", label: "Rejected", count: counts.rejected },
      ]}
      onChange={(key) => {
        const next = new URLSearchParams(params.toString());
        next.delete("status");
        next.delete("page");
        const statuses = BUCKETS[key as keyof typeof BUCKETS];
        if (statuses) next.set("statuses", statuses);
        else next.delete("statuses");
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    />
  );
}

export function ExportMyReports() {
  return (
    <a
      href="/api/export?format=csv"
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft hover:bg-surface-2"
      download
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
    </a>
  );
}

export interface DraftSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export function DraftList({ drafts }: { drafts: DraftSummary[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function removeDraft() {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/drafts?id=${encodeURIComponent(deleting)}`, { method: "DELETE" });
      const data = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't delete this draft.");
      toast.success("Draft deleted.");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this draft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-amber-accent/40 bg-amber-soft/45 p-3">
            <FileText className="h-4 w-4 shrink-0 text-amber-accent" aria-hidden />
            <a href={`/report?draft=${encodeURIComponent(draft.id)}`} className="min-w-0 flex-1 hover:underline">
              <span className="block truncate text-[13px] font-semibold text-ink">{draft.title || "Untitled report"}</span>
              <span className="block text-[11px] text-ink-muted">Saved {formatDateTime(draft.updatedAt)}</span>
            </a>
            <Button variant="ghost" size="icon" onClick={() => setDeleting(draft.id)} aria-label={`Delete draft ${draft.title || "Untitled report"}`}>
              <Trash2 className="h-4 w-4 text-ink-muted" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        onConfirm={() => void removeDraft()}
        title="Delete this draft?"
        message="This saved report will be permanently removed. Your submitted reports won't be affected."
        confirmLabel="Delete draft"
        loading={busy}
      />
    </>
  );
}
