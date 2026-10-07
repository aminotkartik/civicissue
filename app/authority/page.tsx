import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Download, Shield, Timer, Wrench } from "lucide-react";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/drizzle/sqlite/schema";
import { getActiveCategories, getActiveDepartments } from "@/lib/queries/references";
import { getAuthorityCounters, getByCategory, getByLocality, getByPriority, getByStatus, getSatisfaction, getTimeSeries, type GroupCount, type TimeSeriesPoint } from "@/lib/queries/analytics";
import { listIssues } from "@/lib/queries/issues";
import { sweepOverdue } from "@/lib/queries/issue-actions";
import { listIssuesQuerySchema } from "@/lib/validation";
import { StatCard } from "@/components/ui/stat-card";
import { AuthorityFilters, AuthorityQueue } from "@/components/authority/authority-queue";
import { IssuesPagination } from "@/components/issues/issues-browser";
import { IssuesTrendChart, PriorityChart, StatusDonutChart, CategoryBarChart } from "@/components/charts/analytics-charts";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Authority desk", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AuthorityPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/authority");
  if (user.role !== "AUTHORITY" && user.role !== "ADMIN") redirect(user.role === "WORKER" ? "/worker" : "/dashboard");

  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const parsed = listIssuesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listIssuesQuerySchema.parse({});
  const [categories, departments] = await Promise.all([getActiveCategories(), getActiveDepartments()]);
  const db = await getDb();
  let authorityDepartmentId: string | null = null;
  if (user.role === "AUTHORITY") {
    const rows = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, user.id)).limit(1);
    authorityDepartmentId = rows[0]?.departmentId ?? null;
  }
  const requestedDepartment = user.role === "ADMIN" ? flat.departmentId : undefined;
  const adminDepartment = requestedDepartment && departments.some((department) => department.id === requestedDepartment) ? requestedDepartment : null;
  const departmentId = user.role === "AUTHORITY" ? authorityDepartmentId : adminDepartment;
  const lockDepartment = user.role === "AUTHORITY";
  const unassignedAuthority = user.role === "AUTHORITY" && !authorityDepartmentId;

  if (!unassignedAuthority) sweepOverdue().catch(() => {});
  const emptyResult: Awaited<ReturnType<typeof listIssues>> = { items: [], total: 0, page: query.page, pageSize: query.pageSize, totalPages: 0 };
  let result = emptyResult;
  let counters: Awaited<ReturnType<typeof getAuthorityCounters>> = { totalAssigned: 0, pendingVerification: 0, inProgress: 0, overdue: 0, criticalOpen: 0, resolvedThisMonth: 0 };
  let timeSeries: TimeSeriesPoint[] = [];
  let byStatus: GroupCount[] = [];
  let byCategory: GroupCount[] = [];
  let byPriority: GroupCount[] = [];
  let byLocality: GroupCount[] = [];
  let satisfaction: Awaited<ReturnType<typeof getSatisfaction>> = { count: 0, averageRating: 0, resolvedYes: 0, resolvedPartially: 0, resolvedNo: 0, reopenRate: 0 };
  if (!unassignedAuthority) {
    [result, counters, timeSeries, byStatus, byCategory, byPriority, byLocality, satisfaction] = await Promise.all([
      listIssues({ query, viewer: user, scope: "staff", departmentId }),
      getAuthorityCounters(departmentId),
      getTimeSeries(30, departmentId),
      getByStatus(departmentId),
      getByCategory(departmentId),
      getByPriority(departmentId),
      getByLocality(8, departmentId),
      getSatisfaction(departmentId),
    ]);
  }

  const currentDepartment = departments.find((department) => department.id === departmentId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><Shield className="h-4 w-4" aria-hidden /> Operations workspace</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Authority desk</h1>
          <p className="mt-1 text-sm text-ink-muted">{currentDepartment ? `${currentDepartment.name} queue` : user.role === "ADMIN" ? "Platform-wide operations view" : "Department assignment required"} · Triage, assign and track public reports.</p>
        </div>
        {!unassignedAuthority && <a href={`/api/export?format=csv${departmentId ? `&departmentId=${encodeURIComponent(departmentId)}` : ""}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft hover:bg-surface-2"><Download className="h-3.5 w-3.5" aria-hidden /> Export queue</a>}
      </header>

      {unassignedAuthority ? (
        <EmptyState className="mt-8" icon={<Shield className="h-6 w-6" aria-hidden />} title="No department is assigned to your account" message="Ask a platform administrator to assign your account to a municipal department. Until then, no issue queue or department analytics are visible." />
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Queue summary">
            <StatCard label="Open queue" value={formatNumber(counters.totalAssigned)} icon={<ClipboardCheck className="h-4 w-4" />} />
            <StatCard label="Needs verification" value={formatNumber(counters.pendingVerification)} tone="warning" icon={<Clock3 className="h-4 w-4" />} sub="New, review or information" />
            <StatCard label="In field work" value={formatNumber(counters.inProgress)} tone="info" icon={<Wrench className="h-4 w-4" />} />
            <StatCard label="Overdue" value={formatNumber(counters.overdue)} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} sub="Past SLA target" />
            <StatCard label="Critical open" value={formatNumber(counters.criticalOpen)} tone="danger" icon={<Timer className="h-4 w-4" />} />
            <StatCard label="Resolved this month" value={formatNumber(counters.resolvedThisMonth)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          </section>

          <section className="mt-8" aria-labelledby="queue-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="queue-heading" className="text-lg font-bold text-ink">Complaint queue</h2><p className="mt-0.5 text-xs text-ink-muted">Select a case to see its full timeline and permitted actions.</p></div>
            </div>
            <Suspense fallback={<div className="skeleton h-24 rounded-xl" />}>
              <AuthorityFilters
                categories={categories.map((category) => ({ slug: category.slug, name: category.name, icon: category.icon }))}
                departments={user.role === "ADMIN" ? departments.map(({ id, name }) => ({ id, name })) : currentDepartment ? [{ id: currentDepartment.id, name: currentDepartment.name }] : []}
                selectedDepartment={departmentId ?? ""}
                lockDepartment={lockDepartment}
              />
            </Suspense>
            <AuthorityQueue items={result.items} total={result.total} pageStart={(result.page - 1) * result.pageSize} />
            {result.items.length > 0 && <div className="mt-6"><Suspense><IssuesPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} /></Suspense></div>}
          </section>

          <section className="mt-10" aria-labelledby="analytics-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="analytics-heading" className="text-lg font-bold text-ink">Performance & service health</h2><p className="mt-0.5 text-xs text-ink-muted">Computed from this {departmentId ? "department's" : "platform's"} real report and feedback data.</p></div>
              <p className="text-xs text-ink-muted">{satisfaction.count ? `${satisfaction.averageRating.toFixed(1)} / 5 average citizen rating · ${Math.round((1 - satisfaction.reopenRate) * 100)}% not reopened` : "No citizen feedback yet"}</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <IssuesTrendChart data={timeSeries} />
              <StatusDonutChart data={byStatus} />
              <CategoryBarChart data={byCategory} />
              <PriorityChart data={byPriority} />
            </div>
            {byLocality.length > 0 && <section className="mt-4 rounded-xl border border-line bg-surface p-4"><h3 className="text-sm font-bold text-ink">Where reports are coming from</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{byLocality.map((area) => <div key={area.name} className="flex justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs"><span className="truncate text-ink-soft">{area.name}</span><span className="font-semibold tabular-nums text-ink">{formatNumber(area.count)}</span></div>)}</div></section>}
          </section>
        </>
      )}
    </div>
  );
}
