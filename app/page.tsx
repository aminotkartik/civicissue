import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardList,
  Eye,
  MapPin,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { HeroMap } from "@/components/layout/hero-map";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IssueCard } from "@/components/issues/issue-card";
import { getPlatformStats, getCommunityData, getByLocality } from "@/lib/queries/analytics";
import { getActiveCategories } from "@/lib/queries/references";
import { getDb } from "@/lib/db";
import { issues, categories } from "@/drizzle/sqlite/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { publicCoordinates } from "@/lib/queries/issues";
import { formatNumber } from "@/lib/utils/format";
import type { IssueCardData } from "@/lib/types";

// Homepage metrics and recent reports are live database reads, not build-time snapshots.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: ClipboardList,
    title: "1 · Report",
    text: "Describe the problem in your words, attach a photo and drop a pin. Our assistant suggests the right category automatically.",
  },
  {
    icon: BadgeCheck,
    title: "2 · Verify",
    text: "Authority staff review the evidence, confirm the issue is genuine and route it to the responsible department.",
  },
  {
    icon: CheckCircle2,
    title: "3 · Resolve",
    text: "Field workers start the repair, record progress and upload before/after evidence when the work is done.",
  },
  {
    icon: Eye,
    title: "4 · Track",
    text: "Follow every update from submission to resolution — and rate the outcome so quality stays accountable.",
  },
];

export default async function LandingPage() {
  const [stats, communityData, cats, topLocalities, resolvedToday, latestResolved] =
    await Promise.all([
      getPlatformStats(),
      getCommunityData(),
      getActiveCategories(),
      getByLocality(5),
      countResolvedToday(),
      fetchLatestResolved(),
    ]);

  const trendingCards: IssueCardData[] = communityData.trending.map((t) => ({
    id: t.publicId,
    publicId: t.publicId,
    title: t.title,
    category: t.categoryName,
    categoryIcon: "cone",
    status: t.status,
    priority: t.priority,
    priorityScore: 0,
    locality: t.locality,
    city: "Pune",
    latitude: 0,
    longitude: 0,
    locationPrivacy: "EXACT",
    upvotesCount: t.upvotesCount,
    commentsCount: 0,
    confirmationsCount: 0,
    coverImage: null,
    createdAt: t.createdAt,
    updatedAt: t.createdAt,
    resolvedAt: null,
  }));

  return (
    <>
      {/* ------------------------------------------------------------ HERO -- */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, #f4c3b2 0, transparent 30%), radial-gradient(circle at 85% 60%, #d6cbb8 0, transparent 35%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-terra-200 bg-terra-50 px-3.5 py-1.5 text-xs font-semibold text-terra-700">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Civic transparency, built for your neighbourhood
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Your city has a problem.{" "}
              <span className="text-terra-600">Report it.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-base">
              Report potholes, broken streetlights, garbage, drainage issues,
              damaged infrastructure and other civic problems. Track every
              update from submission to resolution.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/report"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-terra-600 px-6 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-terra-700"
              >
                Report an Issue <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/issues"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                Explore Issues
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Reported</dt>
                <dd className="mt-0.5 text-xl font-bold text-ink tabular-nums">{formatNumber(stats.totalReported)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Resolved</dt>
                <dd className="mt-0.5 text-xl font-bold text-verdant tabular-nums">{formatNumber(stats.totalResolved)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Resolution rate</dt>
                <dd className="mt-0.5 text-xl font-bold text-ink tabular-nums">{Math.round(stats.resolutionRate * 100)}%</dd>
              </div>
            </dl>
          </div>
          <HeroMap resolvedToday={resolvedToday} latestResolved={latestResolved} />
        </div>
      </section>

      {/* ------------------------------------------------------ HOW IT WORKS -- */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How CivicIssue works</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            A transparent lifecycle for every complaint — you always know what
            is happening, what happens next, and who is responsible.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-terra-50 text-terra-600">
                <step.icon className="h-5.5 w-5.5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- CATEGORIES -- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">What can you report?</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">
            Every report is routed to the department that can actually fix it —
            with response deadlines attached.
          </p>
          <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/issues?category=${c.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-canvas p-3.5 transition-colors hover:border-terra-300 hover:bg-terra-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terra-100 text-terra-700 transition-colors group-hover:bg-terra-200">
                    <CategoryIcon name={c.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-ink">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- NUMBERS -- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Real numbers, straight from the record
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Every complaint has a status, a responsible department, an update
              history and a resolution record. Statistics below are computed
              live from actual reports on this platform — nothing is hardcoded.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <StatTile label="Issues reported" value={formatNumber(stats.totalReported)} icon={<ClipboardList className="h-4.5 w-4.5" />} />
              <StatTile label="Issues resolved" value={formatNumber(stats.totalResolved)} tone="success" icon={<CheckCircle2 className="h-4.5 w-4.5" />} />
              <StatTile label="Resolution rate" value={`${Math.round(stats.resolutionRate * 100)}%`} tone="info" icon={<TrendingUp className="h-4.5 w-4.5" />} />
              <StatTile
                label="Avg. resolution time"
                value={stats.avgResolutionDays ? `${stats.avgResolutionDays} days` : "—"}
                tone="warning"
                icon={<BarChart3 className="h-4.5 w-4.5" />}
              />
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-verdant" aria-hidden />
              <h3 className="text-[15px] font-bold text-ink">Full transparency, by design</h3>
            </div>
            <ul className="mt-4 space-y-3.5 text-sm text-ink-soft">
              {[
                "Every status change is timestamped and attributed — nothing disappears silently.",
                "Priority scores are deterministic and explainable: you see why an issue ranks HIGH.",
                "Resolution requires evidence. High-priority fixes need an 'after' photo before closing.",
                "Citizens confirm outcomes with feedback, and unresolved problems can be reopened.",
                "Your exact location is shared only with authorized personnel — public views can be approximate.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5 leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-verdant" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- COMMUNITY -- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">In the community</h2>
              <p className="mt-2 text-[15px] text-ink-soft">Most supported this week and freshly resolved issues.</p>
            </div>
            <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-semibold text-terra-600 hover:text-terra-700">
              View community page <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-9 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Most supported this week</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {trendingCards.slice(0, 4).map((card) => (
                  <IssueCard key={card.publicId} issue={card} />
                ))}
              </div>
            </div>
            <div className="space-y-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Most active neighbourhoods</h3>
                <ol className="mt-4 space-y-2.5">
                  {topLocalities.map((l, i) => (
                    <li key={l.name} className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 py-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terra-100 text-[11px] font-bold text-terra-700">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium text-ink">{l.name}</span>
                      <span className="text-sm font-bold text-ink-soft tabular-nums">{l.count}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Recently resolved</h3>
                <ul className="mt-4 space-y-2.5">
                  {communityData.recentlyResolved.slice(0, 5).map((r) => (
                    <li key={r.publicId}>
                      <Link
                        href={`/issues/${r.publicId}`}
                        className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 py-2.5 transition-colors hover:border-verdant/40 hover:bg-verdant-soft/40"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-verdant" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                          <span className="text-[11px] text-ink-muted">{r.locality} · {r.categoryName}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA -- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-ink px-6 py-14 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #d35a34 0, transparent 40%), radial-gradient(circle at 15% 85%, #4d8a5b 0, transparent 35%)" }}
            aria-hidden
          />
          <div className="relative">
            <Camera className="mx-auto h-8 w-8 text-terra-300" aria-hidden />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-canvas sm:text-3xl">
              See something broken in your city?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-canvas/70">
              One photo and two minutes of your time can start the fix. Every
              report gets a tracking ID, a responsible department and a public
              resolution record.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/report"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-terra-500 px-7 text-[15px] font-semibold text-white hover:bg-terra-400"
              >
                Report an Issue <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-canvas/25 px-7 text-[15px] font-semibold text-canvas hover:bg-canvas/10"
              >
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone = "terra",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "terra" | "success" | "info" | "warning";
}) {
  const tones = {
    terra: "bg-terra-50 text-terra-600",
    success: "bg-verdant-soft text-verdant",
    info: "bg-info-soft text-info",
    warning: "bg-amber-soft text-amber-accent",
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`} aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-ink-muted">{label}</p>
    </div>
  );
}

async function countResolvedToday(): Promise<number> {
  try {
    const db = await getDb();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(issues)
      .where(and(sql`${issues.resolvedAt} IS NOT NULL`, gte(issues.resolvedAt, start)));
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function fetchLatestResolved() {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        id: issues.id,
        publicId: issues.publicId,
        title: issues.title,
        locality: issues.locality,
        latitude: issues.latitude,
        longitude: issues.longitude,
        locationPrivacy: issues.locationPrivacy,
      })
      .from(issues)
      .where(and(sql`${issues.resolvedAt} IS NOT NULL`, eq(issues.isPublic, true)))
      .orderBy(desc(issues.resolvedAt))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    void publicCoordinates;
    return { publicId: r.publicId, title: r.title, locality: r.locality };
  } catch {
    return null;
  }
}

void categories;
