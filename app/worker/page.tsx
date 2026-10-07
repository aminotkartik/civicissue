import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { and, count, eq, inArray } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ClipboardList, HardHat, Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { issues } from "@/drizzle/sqlite/schema";
import { getWorkerByUserId } from "@/lib/queries/references";
import { listIssues } from "@/lib/queries/issues";
import { sweepOverdue } from "@/lib/queries/issue-actions";
import { listIssuesQuerySchema } from "@/lib/validation";
import { StatCard } from "@/components/ui/stat-card";
import { WorkerQueue } from "@/components/worker/worker-queue";
import { WorkerTabs } from "@/components/worker/worker-tabs";
import { IssuesFilters, IssuesPagination } from "@/components/issues/issues-browser";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveCategories } from "@/lib/queries/references";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Field jobs", robots: { index: false } };
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "REOPENED", "ESCALATED"] as const;
const ACTIVE_QUERY = ACTIVE_STATUSES.join(",");
const COMPLETED_STATUSES = ["RESOLVED", "CLOSED"] as const;

export default async function WorkerPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/worker");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role !== "WORKER") redirect(user.role === "AUTHORITY" ? "/authority" : "/dashboard");

  const [worker, categories] = await Promise.all([getWorkerByUserId(user.id), getActiveCategories()]);
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const parsed = listIssuesQuerySchema.safeParse(flat);
  const base = parsed.success ? parsed.data : listIssuesQuerySchema.parse({});
  const query = { ...base, statuses: base.status || base.statuses ? base.statuses : ACTIVE_QUERY, pageSize: 12 };

  if (!worker) {
    return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><EmptyState icon={<HardHat className="h-7 w-7" aria-hidden />} title="No active field-worker profile" message="Your login doesn't have an active worker profile. Ask your department administrator to connect your account to a field team." /></div>;
  }

  sweepOverdue().catch(() => {});
  const db = await getDb();
  const [result, statusRows, overdueRows] = await Promise.all([
    listIssues({ query, viewer: user, scope: "staff", workerId: worker.worker.id }),
    db.select({ status: issues.status, n: count() }).from(issues).where(eq(issues.assignedWorkerId, worker.worker.id)).groupBy(issues.status),
    db.select({ n: count() }).from(issues).where(and(eq(issues.assignedWorkerId, worker.worker.id), eq(issues.isOverdue, true), inArray(issues.status, [...ACTIVE_STATUSES]))),
  ]);
  const byStatus = new Map(statusRows.map((row) => [row.status, row.n]));
  const countStatuses = (statuses: readonly string[]) => statuses.reduce((sum, status) => sum + (byStatus.get(status as never) ?? 0), 0);
  const counts = {
    active: countStatuses(ACTIVE_STATUSES),
    assigned: byStatus.get("ASSIGNED" as never) ?? 0,
    inProgress: byStatus.get("IN_PROGRESS" as never) ?? 0,
    completed: countStatuses(COMPLETED_STATUSES),
    all: statusRows.reduce((sum, row) => sum + row.n, 0),
  };
  const overdue = overdueRows[0]?.n ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <header className="rounded-2xl bg-ink p-5 text-canvas sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-7">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-300"><HardHat className="h-4 w-4" aria-hidden /> Field team · {worker.departmentName}</p>
          <h1 className="mt-1.5 text-2xl font-bold">Good day, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-canvas/70">{worker.worker.employeeId}{worker.worker.zone ? ` · ${worker.worker.zone}` : ""} · {counts.active} active job{counts.active === 1 ? "" : "s"} assigned to you.</p>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 sm:mt-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/20 text-amber-200"><ClipboardList className="h-5 w-5" aria-hidden /></div>
          <div><p className="text-2xl font-bold leading-none">{counts.active}</p><p className="mt-1 text-[11px] text-canvas/70">Active field jobs</p></div>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="My job summary">
        <StatCard label="New assignments" value={formatNumber(counts.assigned)} tone="info" icon={<ClipboardList className="h-4 w-4" />} sub="Ready to start" />
        <StatCard label="In progress" value={formatNumber(counts.inProgress)} tone="warning" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Overdue" value={formatNumber(overdue)} tone={overdue ? "danger" : "success"} icon={<AlertTriangle className="h-4 w-4" />} sub="Past service target" />
        <StatCard label="Resolved" value={formatNumber(counts.completed)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      <section className="mt-8" aria-labelledby="jobs-title">
        <div className="mb-3"><h2 id="jobs-title" className="text-lg font-bold text-ink">Your jobs</h2><p className="mt-0.5 text-xs text-ink-muted">Open a job to start work, add a progress note or submit resolution evidence.</p></div>
        <Suspense fallback={<div className="skeleton h-10 rounded-xl" />}><WorkerTabs counts={counts} /></Suspense>
        <div className="mt-3"><Suspense fallback={<div className="skeleton h-11 rounded-xl" />}><IssuesFilters categories={categories.map((category) => ({ slug: category.slug, name: category.name, icon: category.icon }))} /></Suspense></div>
        <WorkerQueue items={result.items} total={result.total} />
        {result.items.length > 0 && <div className="mt-6"><Suspense><IssuesPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} /></Suspense></div>}
      </section>
    </div>
  );
}
