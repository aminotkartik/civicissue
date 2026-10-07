import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Building2, Download, Settings2, ShieldAlert, Users, Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformStats, getTimeSeries, getByCategory, getByStatus, getByPriority, getDepartmentWorkload, getSatisfaction, getZoneHeatmap, detectHotspots } from "@/lib/queries/analytics";
import { StatCard } from "@/components/ui/stat-card";
import { IssuesTrendChart, StatusDonutChart, CategoryBarChart, PriorityChart, DepartmentWorkloadChart } from "@/components/charts/analytics-charts";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Admin console", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [stats, series, categories, statuses, priorities, workload, satisfaction, heatmap, hotspots] = await Promise.all([
    getPlatformStats(),
    getTimeSeries(30),
    getByCategory(),
    getByStatus(),
    getByPriority(),
    getDepartmentWorkload(),
    getSatisfaction(),
    getZoneHeatmap(),
    detectHotspots(7, 4),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><Activity className="h-4 w-4" aria-hidden /> Platform operations</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Admin console</h1>
          <p className="mt-1 text-sm text-ink-muted">Live service metrics, workload, community feedback and audit-ready management tools.</p>
        </div>
        <a href="/api/export?format=csv" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft hover:bg-surface-2"><Download className="h-3.5 w-3.5" aria-hidden /> Export platform data</a>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Platform overview">
        <StatCard label="Public reports" value={formatNumber(stats.totalReported)} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Resolved" value={formatNumber(stats.totalResolved)} tone="success" />
        <StatCard label="Resolution rate" value={`${Math.round(stats.resolutionRate * 100)}%`} tone="info" sub={`Avg. ${stats.avgResolutionDays.toFixed(1)} days`} />
        <StatCard label="Open workload" value={formatNumber(stats.activeIssues)} tone="warning" />
        <StatCard label="Critical open" value={formatNumber(stats.criticalOpen)} tone={stats.criticalOpen ? "danger" : "success"} />
        <StatCard label="Overdue" value={formatNumber(stats.overdueOpen)} tone={stats.overdueOpen ? "danger" : "success"} />
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Platform participation">
        <StatCard label="Active accounts" value={formatNumber(stats.totalUsers)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Community comments" value={formatNumber(stats.totalComments)} />
        <StatCard label="Issue supporters" value={formatNumber(stats.totalSupporters)} />
        <StatCard label="Citizen rating" value={satisfaction.count ? `${satisfaction.averageRating.toFixed(1)} / 5` : "No ratings yet"} tone={satisfaction.count ? "success" : "default"} sub={`${satisfaction.count} feedback responses`} />
      </section>

      <nav className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Administration tools">
        <AdminLink href="/admin/users" icon={<Users className="h-5 w-5" aria-hidden />} title="Users & access" text="Roles, status, suspension and department access." />
        <AdminLink href="/admin/departments" icon={<Building2 className="h-5 w-5" aria-hidden />} title="Departments" text="Municipal departments and service zones." />
        <AdminLink href="/admin/categories" icon={<Wrench className="h-5 w-5" aria-hidden />} title="Categories & SLA" text="Issue routing, categories and service targets." />
        <AdminLink href="/admin/moderation" icon={<ShieldAlert className="h-5 w-5" aria-hidden />} title="Moderation & audit" text="Abuse reports and the accountable action log." />
        <AdminLink href="/admin/settings" icon={<Settings2 className="h-5 w-5" aria-hidden />} title="Settings & SLA" text="Priority weights and platform service targets." />
      </nav>

      <section className="mt-9" aria-labelledby="analytics-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="analytics-title" className="text-lg font-bold text-ink">Platform analytics</h2><p className="mt-0.5 text-xs text-ink-muted">All figures below are computed from the live database.</p></div>
          <ButtonLink href="/authority" variant="secondary" size="sm">Open authority desk <ArrowRight className="h-3.5 w-3.5" aria-hidden /></ButtonLink>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <IssuesTrendChart data={series} />
          <StatusDonutChart data={statuses} />
          <CategoryBarChart data={categories} />
          <PriorityChart data={priorities} />
          <DepartmentWorkloadChart data={workload} />
          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h3 className="text-sm font-bold text-ink">SLA service performance</h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">Open cases are escalated by the SLA sweep; resolved cases are compared with their stored deadline.</p>
            {workload.length ? <ul className="mt-4 space-y-3">{workload.slice(0, 6).map((department) => <li key={department.id}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-ink">{department.name}</span><span className="shrink-0 text-ink-muted">{Math.round(department.slaCompliance * 100)}% within SLA</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-verdant" style={{ width: `${Math.max(0, Math.min(100, department.slaCompliance * 100))}%` }} /></div>
              <p className="mt-1 text-[10px] text-ink-muted">{department.overdue} overdue · {department.avgResolutionDays.toFixed(1)}d average resolution</p>
            </li>)}</ul> : <p className="mt-6 text-xs text-ink-muted">No departments to report on yet.</p>}
          </section>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-bold text-ink">Issue hotspots</h2><p className="mt-0.5 text-[11px] text-ink-muted">Clusters of at least four public reports in a roughly 800 m grid over the last seven days.</p>
          {hotspots.length ? <ul className="mt-3 divide-y divide-line">{hotspots.map((spot, i) => <li key={`${spot.latitude}-${spot.longitude}`} className="flex items-center gap-3 py-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-alert-soft text-xs font-bold text-alert">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{spot.label}</span><span className="mt-0.5 block text-[10px] text-ink-muted">{spot.count} reports · most common: {spot.topCategory}</span></span><a className="text-[10px] font-semibold text-terra-700 hover:underline" href={`/map?lat=${spot.latitude}&lng=${spot.longitude}`}>View</a></li>)}</ul> : <p className="mt-5 rounded-lg bg-surface-2 p-3 text-xs text-ink-muted">No report clusters have crossed the current hotspot threshold.</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-bold text-ink">Activity by zone</h2><p className="mt-0.5 text-[11px] text-ink-muted">Real report counts by submitted zone or locality.</p>
          {heatmap.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{heatmap.slice(0, 10).map((zone) => <div key={zone.zone} className="rounded-lg border border-line bg-canvas p-3"><div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-semibold text-ink">{zone.zone}</span><span className="text-sm font-bold text-terra-700">{zone.total}</span></div><p className="mt-1 text-[10px] text-ink-muted">{zone.open} open · {zone.road} road / footpath reports</p></div>)}</div> : <p className="mt-5 text-xs text-ink-muted">No location data available yet.</p>}
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-xs text-ink-muted">
        <span>Feedback responses: {satisfaction.count} · Reopened cases: {Math.round(satisfaction.reopenRate * 100)}% of all issues</span>
        <Link href="/admin/moderation?tab=audit" className="font-semibold text-terra-700 hover:underline">View audit log →</Link>
      </footer>
    </div>
  );
}

function AdminLink({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link href={href} className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-terra-200 hover:bg-terra-50/40"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-terra-50 text-terra-700">{icon}</span><span className="mt-3 flex items-center gap-1 text-sm font-bold text-ink">{title}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span><span className="mt-1 block text-xs leading-relaxed text-ink-muted">{text}</span></Link>;
}
