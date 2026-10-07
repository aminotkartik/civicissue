import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ArrowLeft, BellRing } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getIssueDetail } from "@/lib/queries/issues";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { ShareButton } from "@/components/issues/share-button";

export const metadata: Metadata = { title: "Report submitted", robots: { index: false } };

export default async function ReportSuccessPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/report/success/${publicId}`);
  const detail = await getIssueDetail(publicId, user);
  if (!detail || detail.issue.createdById !== user.id) notFound();

  const issue = detail.issue;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-verdant-soft text-verdant">
          <CheckCircle2 className="h-9 w-9" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
          Your report is on its way.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          We&apos;ve received your complaint and given it a tracking ID. You&apos;ll be
          notified at every step.
        </p>

        <div className="mx-auto mt-7 max-w-sm rounded-xl border border-line bg-canvas p-5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Complaint ID</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide text-terra-700">{issue.publicId}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} score={issue.priorityScore} />
          </div>
          {issue.slaDeadline && (
            <p className="mt-3 text-xs text-ink-muted">
              Target resolution by{" "}
              <span className="font-semibold text-ink-soft">
                {issue.slaDeadline.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>{" "}
              per the {issue.priority.toLowerCase()}-priority service deadline.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-info-soft px-4 py-3 text-left">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <p className="text-xs leading-relaxed text-ink-soft">
            <strong className="text-info">What happens next:</strong> your report is waiting
            for authority review. Once verified, it will be assigned to{" "}
            {detail.department?.name ?? "the responsible department"} and you&apos;ll see every
            update on the tracking page.
          </p>
        </div>

        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link
            href={`/issues/${issue.publicId}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-terra-600 px-6 text-sm font-semibold text-white hover:bg-terra-700"
          >
            Track Report
          </Link>
          <ShareButton publicId={issue.publicId} title={issue.title} variant="secondary" />
          <Link
            href="/report"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Report Another Issue
          </Link>
        </div>
        <Link href="/dashboard" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-terra-600">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
