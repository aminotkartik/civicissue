import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  MapPinned,
  Plus,
  Wrench,
} from "lucide-react";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { issues, categories, notifications, drafts } from "@/drizzle/sqlite/schema";
import { StatCard } from "@/components/ui/stat-card";
import { IssueCard } from "@/components/issues/issue-card";
import { Timeline } from "@/components/issues/timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { publicCoordinates } from "@/lib/queries/issues";
import { OPEN_STATUSES } from "@/lib/types";
import type { IssueCardData, IssueStatus, Priority } from "@/lib/types";
import { formatNumber } from "@/lib/utils/format";
import { LiveRegion } from "@/components/dashboard/live-region";

export const metadata: Metadata = { title: "My dashboard", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function CitizenDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "AUTHORITY") redirect("/authority");
  if (user.role === "WORKER") redirect("/worker");

  const db = await getDb();

  const [myIssues, recentEvents, myDrafts, unreadCount, platformStats] = await Promise.all([
    db
      .select({
        id: issues.id,
        publicId: issues.publicId,
        title: issues.title,
        status: issues.status,
        priority: issues.priority,
        priorityScore: issues.priorityScore,
        locality: issues.locality,
        city: issues.city,
        latitude: issues.latitude,
        longitude: issues.longitude,
        locationPrivacy: issues.locationPrivacy,
        upvotesCount: issues.upvotesCount,
        commentsCount: issues.commentsCount,
        confirmationsCount: issues.confirmationsCount,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        resolvedAt: issues.resolvedAt,
        categoryName: categories.name,
        categoryIcon: categories.icon,
      })
      .from(issues)
      .innerJoin(categories, eq(issues.categoryId, categories.id))
      .where(eq(issues.createdById, user.id))
      .orderBy(desc(issues.updatedAt))
      .limit(20),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(8),
    db.select().from(drafts).where(eq(drafts.userId, user.id)).orderBy(desc(drafts.updatedAt)).limit(3),
    db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
    db
      .select({
        resolved: sql<number>`count(case when ${issues.resolvedAt} is not null then 1 end)`,
        total: sql<number>`count(*)`,
      })
      .from(issues)
      .where(eq(issues.isPublic, true)),
  ]);

  const counts = {
    total: myIssues.length,
    underReview: myIssues.filter((i) => ["SUBMITTED", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "VERIFIED"].includes(i.status)).length,
    inProgress: myIssues.filter((i) => ["ASSIGNED", "IN_PROGRESS", "ESCALATED", "REOPENED"].includes(i.status)).length,
    resolved: myIssues.filter((i) => ["RESOLVED", "CLOSED"].includes(i.status)).length,
  };

  const cards: IssueCardData[] = myIssues.slice(0, 3).map((r) => {
    const coords = publicCoordinates(r);
    return {
      id: r.id,
      publicId: r.publicId,
      title: r.title,
      category: r.categoryName,
      categoryIcon: r.categoryIcon,
      status: r.status as IssueStatus,
      priority: r.priority as Priority,
      priorityScore: r.priorityScore,
      locality: r.locality,
      city: r.city,
      latitude: coords.latitude,
      longitude: coords.longitude,
      locationPrivacy: r.locationPrivacy,
      upvotesCount: r.upvotesCount,
      commentsCount: r.commentsCount,
      confirmationsCount: r.confirmationsCount,
      coverImage: null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      resolvedAt: r.resolvedAt,
    };
  });

  const timelineItems = recentEvents.map((n) => ({
    id: n.id,
    message: n.title === n.message ? n.title : `${n.title} — ${n.message}`,
    timestamp: n.createdAt,
    done: true,
    actorRole: null,
  }));

  void inArray;
  void OPEN_STATUSES;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LiveRegion />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here&apos;s what&apos;s happening with your reports and your city
            {user.locality ? ` · ${user.locality}` : ""}.
          </p>
        </div>
        <ButtonLink href="/report" size="lg">
          <Plus className="h-4 w-4" aria-hidden /> Report Issue
        </ButtonLink>
      </div>

      {/* Summary cards */}
      <section className="mt-7 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4" aria-label="My reports summary">
        <StatCard label="My Reports" value={formatNumber(counts.total)} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Under Review" value={formatNumber(counts.underReview)} tone="warning" icon={<Clock3 className="h-4 w-4" />} sub="Waiting for authority" />
        <StatCard label="In Progress" value={formatNumber(counts.inProgress)} tone="info" icon={<Wrench className="h-4 w-4" />} sub="Work assigned or started" />
        <StatCard label="Resolved" value={formatNumber(counts.resolved)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} sub="Fixed and evidenced" />
      </section>

      {/* Quick actions */}
      <section className="mt-4 grid gap-3.5 sm:grid-cols-3" aria-label="Quick actions">
        <QuickAction href="/report" icon={<Plus className="h-5 w-5" />} title="Report Issue" text="Photo, location, two minutes — start a fix." tone="terra" />
        <QuickAction href="/nearby" icon={<MapPinned className="h-5 w-5" />} title="View Nearby Issues" text="See what's reported around you." />
        <QuickAction href="/my-reports" icon={<FileText className="h-5 w-5" />} title="My Reports" text="Track every complaint you've filed." />
      </section>

      {/* Drafts */}
      {myDrafts.length > 0 && (
        <section className="mt-8" aria-label="Unfinished drafts">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Unfinished drafts</h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {myDrafts.map((d) => {
              let title = "Untitled draft";
              try {
                const payload = JSON.parse(d.payload) as { state?: { title?: string } };
                if (payload.state?.title) title = payload.state.title;
              } catch { /* keep default */ }
              return (
                <li key={d.id}>
                  <Link href="/report" className="flex items-center gap-3 rounded-xl border border-dashed border-amber-accent/50 bg-amber-soft/60 px-4 py-3 hover:bg-amber-soft">
                    <FileText className="h-4 w-4 shrink-0 text-amber-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{title}</span>
                      <span className="text-[11px] text-ink-muted">Resume your saved report</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent reports */}
        <section aria-labelledby="recent-reports">
          <div className="flex items-center justify-between">
            <h2 id="recent-reports" className="text-sm font-bold uppercase tracking-wide text-ink-muted">Recent reports</h2>
            <Link href="/my-reports" className="inline-flex items-center gap-1 text-[13px] font-semibold text-terra-600 hover:text-terra-700">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {cards.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={<ClipboardList className="h-6 w-6" />}
              title="You haven't reported any civic issues yet."
              message="Spotted a pothole, a broken streetlight or overflowing garbage? Your report starts the fix."
              action={<ButtonLink href="/report">Report Your First Issue</ButtonLink>}
            />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => (
                <IssueCard key={c.id} issue={c} />
              ))}
            </div>
          )}
        </section>

        {/* Activity timeline */}
        <section aria-labelledby="activity">
          <div className="flex items-center justify-between">
            <h2 id="activity" className="text-sm font-bold uppercase tracking-wide text-ink-muted">Activity</h2>
            <Link href="/notifications" className="inline-flex items-center gap-1 text-[13px] font-semibold text-terra-600 hover:text-terra-700">
              All notifications {unreadCount[0]?.n ? `(${unreadCount[0].n} new)` : ""}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 rounded-card border border-line bg-surface p-5 shadow-card">
            {timelineItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">You&apos;re all caught up.</p>
            ) : (
              <Timeline items={timelineItems} />
            )}
          </div>
          <div className="mt-4 rounded-card border border-line bg-surface-2/60 p-4">
            <p className="text-xs leading-relaxed text-ink-soft">
              <strong className="text-ink">City-wide:</strong>{" "}
              {formatNumber(platformStats[0]?.total ?? 0)} public reports filed,{" "}
              {formatNumber(platformStats[0]?.resolved ?? 0)} resolved so far.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  text,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone?: "terra";
}) {
  return (
    <Link
      href={href}
      className={
        tone === "terra"
          ? "group flex items-center gap-4 rounded-card bg-terra-600 p-5 text-white shadow-card transition-colors hover:bg-terra-700"
          : "group flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-terra-300 hover:bg-terra-50/40"
      }
    >
      <span
        className={
          tone === "terra"
            ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"
            : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terra-50 text-terra-600 group-hover:bg-terra-100"
        }
        aria-hidden
      >
        {icon}
      </span>
      <span>
        <span className={cnTitle(tone)}>{title}</span>
        <span className={cnText(tone)}>{text}</span>
      </span>
    </Link>
  );
}

const cnTitle = (tone?: "terra") =>
  `block text-[15px] font-bold ${tone === "terra" ? "text-white" : "text-ink"}`;
const cnText = (tone?: "terra") =>
  `mt-0.5 block text-xs leading-relaxed ${tone === "terra" ? "text-white/75" : "text-ink-muted"}`;
