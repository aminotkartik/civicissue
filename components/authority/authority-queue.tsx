"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ClipboardCheck, MapPin } from "lucide-react";
import { IssuesFilters } from "@/components/issues/issues-browser";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, timeAgo } from "@/lib/utils/format";
import type { IssueCardData } from "@/lib/types";
import type { CategoryChip } from "@/components/issues/issues-browser";

export function DepartmentSelect({ departments, selected, disabled = false }: { departments: { id: string; name: string }[]; selected: string; disabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
      Department
      <Select value={selected} disabled={disabled} onChange={(event) => {
        const next = new URLSearchParams(params.toString());
        if (event.target.value) next.set("departmentId", event.target.value);
        else next.delete("departmentId");
        next.delete("page");
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }} className="min-w-48 text-sm" aria-label="Filter by department">
        {!disabled && <option value="">All departments</option>}
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </Select>
    </label>
  );
}

export function AuthorityFilters({ categories, departments, selectedDepartment, lockDepartment = false }: {
  categories: CategoryChip[];
  departments: { id: string; name: string }[];
  selectedDepartment: string;
  lockDepartment?: boolean;
}) {
  return (
    <div className="space-y-3">
      {departments.length > 0 && <div className="flex justify-end"><DepartmentSelect departments={departments} selected={selectedDepartment} disabled={lockDepartment} /></div>}
      <IssuesFilters categories={categories} />
    </div>
  );
}

export function AuthorityQueue({ items, total, pageStart = 0 }: { items: IssueCardData[]; total: number; pageStart?: number }) {
  if (!items.length) {
    return <EmptyState className="mt-4" icon={<ClipboardCheck className="h-6 w-6" aria-hidden />} title="No cases in this view" message="Try clearing a filter or check back as new reports are submitted." action={<ButtonLink href="/authority" variant="secondary">Clear filters</ButtonLink>} />;
  }
  return (
    <section className="mt-4" aria-label={`${total} cases in authority queue`}>
      {/* Dense table on wide screens, actionable stacked rows on mobile. */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Department complaint queue. Select a case to verify, assign or update it.</caption>
          <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted">
            <tr><th scope="col" className="px-4 py-3 font-bold">Report</th><th scope="col" className="px-3 py-3 font-bold">Status</th><th scope="col" className="px-3 py-3 font-bold">Priority</th><th scope="col" className="px-3 py-3 font-bold">Location</th><th scope="col" className="px-3 py-3 font-bold">Updated</th><th scope="col" className="px-3 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((issue) => <tr key={issue.id} className="hover:bg-surface-2/50">
              <td className="max-w-[420px] px-4 py-3">
                <Link href={`/issues/${issue.publicId}`} className="block font-semibold text-[13px] text-ink hover:text-terra-700 hover:underline">{issue.title}</Link>
                <span className="mt-1 block font-mono text-[10px] text-ink-muted">{issue.publicId} · {issue.category}</span>
              </td>
              <td className="px-3 py-3"><StatusBadge status={issue.status} /></td>
              <td className="px-3 py-3"><PriorityBadge priority={issue.priority} score={issue.priorityScore} /></td>
              <td className="max-w-40 truncate px-3 py-3 text-xs text-ink-soft">{issue.locality ?? issue.city ?? "Location withheld"}</td>
              <td className="whitespace-nowrap px-3 py-3 text-[11px] text-ink-muted" title={formatDateTime(issue.updatedAt)}>{timeAgo(issue.updatedAt)}</td>
              <td className="px-3 py-3"><Link href={`/issues/${issue.publicId}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-terra-700 hover:bg-terra-50">Review <ArrowUpRight className="h-3 w-3" aria-hidden /></Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      <ol className="space-y-2 md:hidden">
        {items.map((issue) => <li key={issue.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-ink-muted">{issue.publicId}</span><StatusBadge status={issue.status} /><PriorityBadge priority={issue.priority} score={issue.priorityScore} /></div>
          <Link href={`/issues/${issue.publicId}`} className="mt-2 block text-sm font-semibold leading-snug text-ink hover:text-terra-700">{issue.title}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
            <span>{issue.category}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{issue.locality ?? issue.city ?? "Location withheld"}</span>
            <span>{timeAgo(issue.updatedAt)}</span>
          </div>
          <Link href={`/issues/${issue.publicId}`} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-canvas hover:bg-ink/90">Review case <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </li>)}
      </ol>
      <p className="mt-2 text-right text-[11px] text-ink-muted">Showing {pageStart + 1}–{Math.min(pageStart + items.length, total)} of {total}</p>
    </section>
  );
}
