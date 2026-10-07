"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, MapPin, Timer, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, timeAgo } from "@/lib/utils/format";
import type { IssueCardData } from "@/lib/types";

export function WorkerQueue({ items, total }: { items: IssueCardData[]; total: number }) {
  if (!items.length) return <EmptyState className="mt-5" icon={<Wrench className="h-6 w-6" aria-hidden />} title="No field jobs in this view" message="When a case is assigned to you, it will appear here with location, priority and a link to field actions." />;
  return (
    <section className="mt-5" aria-label={`${total} assigned field jobs`}>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((issue) => (
          <article key={issue.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-ink-muted">{issue.publicId}</span>
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} score={issue.priorityScore} />
            </div>
            <h2 className="mt-2 text-base font-bold leading-snug text-ink">{issue.title}</h2>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>{issue.category}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{issue.locality ?? issue.city ?? "Location withheld"}</span>
              {issue.departmentName && <span>{issue.departmentName}</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1" title={`Updated ${formatDateTime(issue.updatedAt)}`}><CalendarClock className="h-3.5 w-3.5" aria-hidden />{timeAgo(issue.updatedAt)}</span>
                {issue.status === "IN_PROGRESS" && <span className="inline-flex items-center gap-1 font-semibold text-info"><Timer className="h-3.5 w-3.5" aria-hidden />In the field</span>}
              </div>
              <Link href={`/issues/${issue.publicId}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-semibold text-canvas hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-500">
                Open job <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-right text-xs text-ink-muted">{total.toLocaleString("en-IN")} job{total === 1 ? "" : "s"} assigned to you</p>
    </section>
  );
}
