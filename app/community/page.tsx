import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, HeartHandshake, MapPin, MessageCircle, TrendingUp, Users } from "lucide-react";
import { getCommunityData, getByLocality, getPlatformStats } from "@/lib/queries/analytics";
import { StatusBadge } from "@/components/issues/status-badge";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, timeAgo } from "@/lib/utils/format";
import type { IssueStatus, Priority } from "@/lib/types";

export const metadata: Metadata = {
  title: "Community",
  description: "See the civic issues neighbours are supporting and the improvements the community has helped resolve.",
};
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const [community, stats, localities] = await Promise.all([
    getCommunityData(),
    getPlatformStats(),
    getByLocality(6),
  ]);
  const maxLocalityCount = Math.max(1, ...localities.map((item) => item.count));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-terra-700"><HeartHandshake className="h-4 w-4" aria-hidden /> Neighbours in action</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Better streets, together.</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">Follow the issues residents are backing, see recently completed work and understand where the community is speaking up.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/map" variant="secondary">Explore the map</ButtonLink>
          <ButtonLink href="/report">Report an issue</ButtonLink>
        </div>
      </header>

      <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Community activity">
        <CommunityStat icon={<Users className="h-4 w-4" aria-hidden />} label="Public reports" value={formatNumber(stats.totalReported)} />
        <CommunityStat icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} label="Resolved" value={formatNumber(stats.totalResolved)} tone="green" />
        <CommunityStat icon={<TrendingUp className="h-4 w-4" aria-hidden />} label="Resolution rate" value={`${Math.round(stats.resolutionRate * 100)}%`} />
        <CommunityStat icon={<MessageCircle className="h-4 w-4" aria-hidden />} label="Community supporters" value={formatNumber(stats.totalSupporters)} />
      </section>

      <div className="mt-9 grid gap-8 lg:grid-cols-[1.35fr_0.85fr]">
        <section aria-labelledby="trending-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-terra-700">Last 7 days</p>
              <h2 id="trending-title" className="mt-1 text-lg font-bold text-ink">Issues neighbours are supporting</h2>
            </div>
            <Link href="/issues?sort=support" className="inline-flex items-center gap-1 text-xs font-semibold text-terra-700 hover:underline">View all <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          {community.trending.length ? (
            <ol className="space-y-2.5">
              {community.trending.map((issue, index) => (
                <li key={issue.publicId}>
                  <Link href={`/issues/${issue.publicId}`} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-terra-200 hover:bg-terra-50/30">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terra-50 text-xs font-bold text-terra-700">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-muted">{issue.publicId}</span>
                        <StatusBadge status={issue.status as IssueStatus} />
                        <PriorityBadge priority={issue.priority as Priority} />
                      </span>
                      <span className="mt-1.5 block text-sm font-semibold leading-snug text-ink">{issue.title}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                        <span>{issue.categoryName}</span>
                        {issue.locality && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{issue.locality}</span>}
                        <span>{timeAgo(issue.createdAt)}</span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-terra-50 px-2.5 py-1 text-xs font-bold text-terra-700" aria-label={`${issue.upvotesCount} supporters`}>♥ {formatNumber(issue.upvotesCount)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No new issues this week" message="New public reports will appear here as neighbours raise them." />
          )}
        </section>

        <aside className="space-y-8">
          <section aria-labelledby="resolved-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-verdant">Community wins</p>
                <h2 id="resolved-title" className="mt-1 text-lg font-bold text-ink">Recently resolved</h2>
              </div>
              <Link href="/resolved" className="inline-flex items-center gap-1 text-xs font-semibold text-terra-700 hover:underline">Gallery <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            {community.recentlyResolved.length ? (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
                {community.recentlyResolved.map((issue) => (
                  <li key={issue.publicId}>
                    <Link href={`/issues/${issue.publicId}`} className="block py-3.5 hover:text-terra-700">
                      <span className="flex items-center justify-between gap-2">
                        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{issue.title}</span>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-verdant" aria-label="Resolved" />
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                        <span className="truncate">{issue.categoryName}{issue.locality ? ` · ${issue.locality}` : ""}</span>
                        <span className="shrink-0">{timeAgo(issue.resolvedAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="The next win starts here" message="As reports are resolved, they will be celebrated in this space." />
            )}
          </section>

          <section aria-labelledby="areas-title" className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-terra-600" aria-hidden />
              <div>
                <h2 id="areas-title" className="text-sm font-bold text-ink">Neighbourhood activity</h2>
                <p className="text-[11px] text-ink-muted">Public reports by locality</p>
              </div>
            </div>
            {localities.length ? (
              <ul className="space-y-3">
                {localities.map((area) => (
                  <li key={area.name}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ink">{area.name}</span>
                      <span className="shrink-0 text-ink-muted">{formatNumber(area.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><div className="h-full rounded-full bg-terra-500" style={{ width: `${Math.max(4, (area.count / maxLocalityCount) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-ink-muted">No locality data yet.</p>}
            <Link href="/map" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-terra-700 hover:underline">See reports on the map <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </section>
        </aside>
      </div>

      <section className="mt-10 rounded-2xl bg-ink px-6 py-7 text-canvas sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8">
        <div>
          <h2 className="text-lg font-bold">Your neighbourhood knows what needs fixing.</h2>
          <p className="mt-1 max-w-xl text-sm text-canvas/75">A clear photo, a useful location and a few neighbours in support can help the right team act sooner.</p>
        </div>
        <ButtonLink href="/report" className="mt-4 shrink-0 sm:mt-0">Start a report <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
      </section>
    </div>
  );
}

function CommunityStat({ icon, label, value, tone = "terra" }: { icon: React.ReactNode; label: string; value: string; tone?: "terra" | "green" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 sm:p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone === "green" ? "bg-verdant-soft text-verdant" : "bg-terra-50 text-terra-700"}`}>{icon}</div>
      <p className="text-lg font-bold text-ink sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-ink-muted">{label}</p>
    </div>
  );
}
