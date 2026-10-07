/**
 * Analytics & statistics — always computed from real database rows (spec §47,
 * §48, §49, §89). Every chart on the platform is backed by a function here.
 */
import { cache } from "react";
import { and, desc, eq, gte, inArray, sql, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  issues,
  users,
  categories,
  departments,
  feedback,
  comments,
  upvotes,
} from "@/drizzle/sqlite/schema";
import { OPEN_STATUSES, RESOLVED_STATUSES } from "@/lib/types";

export interface PlatformStats {
  totalReported: number;
  totalResolved: number;
  resolutionRate: number; // 0..1
  avgResolutionDays: number;
  activeIssues: number;
  criticalOpen: number;
  overdueOpen: number;
  totalUsers: number;
  totalComments: number;
  totalSupporters: number;
}

/** Public landing-page statistics (cached briefly — spec §120). */
export const getPlatformStats = cache(async (): Promise<PlatformStats> => {
  const db = await getDb();
  const [totals, resolvedAgg, userCount, commentCount, supportCount, criticalOpen, overdueOpen, activeCount] =
    await Promise.all([
      db.select({ n: count() }).from(issues).where(eq(issues.isPublic, true)),
      db
        .select({
          n: count(),
          avgMs: sql<number>`avg(
            case when ${issues.resolvedAt} is not null
              then (${issues.resolvedAt} - ${issues.createdAt})
            end
          )`,
        })
        .from(issues)
        .where(and(eq(issues.isPublic, true), inArray(issues.status, [...RESOLVED_STATUSES]))),
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(comments),
      db.select({ n: count() }).from(upvotes),
      db
        .select({ n: count() })
        .from(issues)
        .where(and(eq(issues.priority, "CRITICAL"), inArray(issues.status, [...OPEN_STATUSES]))),
      db
        .select({ n: count() })
        .from(issues)
        .where(and(eq(issues.isOverdue, true), inArray(issues.status, [...OPEN_STATUSES]))),
      db
        .select({ n: count() })
        .from(issues)
        .where(inArray(issues.status, [...OPEN_STATUSES])),
    ]);

  const total = totals[0]?.n ?? 0;
  const resolved = resolvedAgg[0]?.n ?? 0;
  // resolvedAgg.avgMs — SQLite gives ms difference; Postgres interval is cast below.
  const avgMsRaw = resolvedAgg[0]?.avgMs as unknown;
  let avgResolutionDays = 0;
  if (typeof avgMsRaw === "number" && Number.isFinite(avgMsRaw)) {
    avgResolutionDays = avgMsRaw / 86_400_000;
  } else if (typeof avgMsRaw === "string") {
    // Postgres interval string like "3 days 04:05:06"
    const d = avgMsRaw.match(/(\d+)\s+day/);
    const h = avgMsRaw.match(/(\d+):(\d+):(\d+)/);
    avgResolutionDays = (d ? parseInt(d[1]!, 10) : 0) + (h ? parseInt(h[1]!, 10) / 24 : 0);
  }

  return {
    totalReported: total,
    totalResolved: resolved,
    resolutionRate: total ? resolved / total : 0,
    avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
    activeIssues: activeCount[0]?.n ?? 0,
    criticalOpen: criticalOpen[0]?.n ?? 0,
    overdueOpen: overdueOpen[0]?.n ?? 0,
    totalUsers: userCount[0]?.n ?? 0,
    totalComments: commentCount[0]?.n ?? 0,
    totalSupporters: supportCount[0]?.n ?? 0,
  };
});

export interface TimeSeriesPoint {
  label: string;
  reported: number;
  resolved: number;
}

/** Issues reported vs resolved per day/week for the last N days. */
export async function getTimeSeries(days = 30, departmentId?: string | null): Promise<TimeSeriesPoint[]> {
  const db = await getDb();
  const { isPostgres } = await import("@/lib/db");
  const since = new Date(Date.now() - days * 86_400_000);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const out: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push({ label: key(d), reported: 0, resolved: 0 });
  }
  const index = new Map(out.map((p, i) => [p.label, i]));

  if (isPostgres) {
    // Dialect-neutral bucketing in application code.
    const all = await db
      .select({ createdAt: issues.createdAt, resolvedAt: issues.resolvedAt })
      .from(issues)
      .where(departmentId
        ? and(gte(issues.createdAt, since), eq(issues.departmentId, departmentId))
        : gte(issues.createdAt, since));
    for (const r of all) {
      const i = index.get(key(r.createdAt));
      if (i !== undefined) out[i]!.reported++;
      if (r.resolvedAt) {
        const j = index.get(key(r.resolvedAt));
        if (j !== undefined) out[j]!.resolved++;
      }
    }
    return out;
  }

  const createdDay = sql<string>`strftime('%Y-%m-%d', ${issues.createdAt} / 1000, 'unixepoch')`;
  const resolvedDay = sql<string>`strftime('%Y-%m-%d', ${issues.resolvedAt} / 1000, 'unixepoch')`;
  const rows = await db
    .select({ day: createdDay, reported: count() })
    .from(issues)
    .where(departmentId
      ? and(gte(issues.createdAt, since), eq(issues.departmentId, departmentId))
      : gte(issues.createdAt, since))
    .groupBy(createdDay)
    .orderBy(createdDay);
  const resolvedRows = await db
    .select({ day: resolvedDay, resolved: count() })
    .from(issues)
    .where(departmentId
      ? and(sql`${issues.resolvedAt} IS NOT NULL`, gte(issues.resolvedAt, since), eq(issues.departmentId, departmentId))
      : and(sql`${issues.resolvedAt} IS NOT NULL`, gte(issues.resolvedAt, since)))
    .groupBy(resolvedDay);
  for (const r of rows) {
    const i = index.get(r.day);
    if (i !== undefined) out[i]!.reported = r.reported;
  }
  for (const r of resolvedRows) {
    const i = index.get(r.day);
    if (i !== undefined) out[i]!.resolved = r.resolved;
  }
  return out;
}

export interface GroupCount {
  name: string;
  slug?: string;
  icon?: string;
  count: number;
}

export async function getByCategory(departmentId?: string | null): Promise<GroupCount[]> {
  const db = await getDb();
  const conditions = [];
  if (departmentId) conditions.push(eq(issues.departmentId, departmentId));
  const rows = await db
    .select({ name: categories.name, slug: categories.slug, icon: categories.icon, n: count() })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(categories.id)
    .orderBy(desc(count()));
  return rows.map((r) => ({ name: r.name, slug: r.slug, icon: r.icon, count: r.n }));
}

export async function getByLocality(limit = 10, departmentId?: string | null): Promise<GroupCount[]> {
  const db = await getDb();
  const localityExpr = sql<string>`coalesce(${issues.zone}, ${issues.locality}, 'Unknown')`;
  const rows = await db
    .select({ name: localityExpr, n: count() })
    .from(issues)
    .where(departmentId ? eq(issues.departmentId, departmentId) : undefined)
    .groupBy(localityExpr)
    .orderBy(desc(count()))
    .limit(limit);
  return rows.map((r) => ({ name: String(r.name ?? "Unknown"), count: r.n }));
}

export async function getByStatus(departmentId?: string | null): Promise<GroupCount[]> {
  const db = await getDb();
  const conditions = [];
  if (departmentId) conditions.push(eq(issues.departmentId, departmentId));
  const rows = await db
    .select({ name: issues.status, n: count() })
    .from(issues)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(issues.status)
    .orderBy(desc(count()));
  return rows.map((r) => ({ name: r.name, count: r.n }));
}

export async function getByPriority(departmentId?: string | null): Promise<GroupCount[]> {
  const db = await getDb();
  const conditions = [];
  if (departmentId) conditions.push(eq(issues.departmentId, departmentId));
  const rows = await db
    .select({ name: issues.priority, n: count() })
    .from(issues)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(issues.priority);
  return rows.map((r) => ({ name: r.name, count: r.n }));
}

export interface DepartmentWorkload {
  id: string;
  name: string;
  open: number;
  inProgress: number;
  overdue: number;
  resolved30d: number;
  avgResolutionDays: number;
  slaCompliance: number; // 0..1 of resolved within SLA
}

export async function getDepartmentWorkload(): Promise<DepartmentWorkload[]> {
  const db = await getDb();
  const depts = await db.select().from(departments).where(eq(departments.active, true));
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  return Promise.all(
    depts.map(async (d) => {
      const deptIssues = await db
        .select({
          status: issues.status,
          isOverdue: issues.isOverdue,
          createdAt: issues.createdAt,
          resolvedAt: issues.resolvedAt,
          slaDeadline: issues.slaDeadline,
        })
        .from(issues)
        .where(eq(issues.departmentId, d.id));
      const open = deptIssues.filter((i) => OPEN_STATUSES.includes(i.status));
      const resolved30 = deptIssues.filter(
        (i) => i.resolvedAt && i.resolvedAt >= since30
      );
      const allResolved = deptIssues.filter((i) => i.resolvedAt && i.slaDeadline);
      const withinSla = allResolved.filter(
        (i) => i.resolvedAt!.getTime() <= i.slaDeadline!.getTime()
      );
      const avgDays = allResolved.length
        ? allResolved.reduce(
            (s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()),
            0
          ) / allResolved.length / 86_400_000
        : 0;
      return {
        id: d.id,
        name: d.name,
        open: open.length,
        inProgress: open.filter((i) => i.status === "IN_PROGRESS").length,
        overdue: open.filter((i) => i.isOverdue).length,
        resolved30d: resolved30.length,
        avgResolutionDays: Math.round(avgDays * 10) / 10,
        slaCompliance: allResolved.length ? withinSla.length / allResolved.length : 1,
      };
    })
  );
}

export interface SatisfactionStats {
  count: number;
  averageRating: number;
  resolvedYes: number;
  resolvedPartially: number;
  resolvedNo: number;
  reopenRate: number;
}

export async function getSatisfaction(departmentId?: string | null): Promise<SatisfactionStats> {
  const db = await getDb();
  const fbRows = departmentId
    ? await db
        .select({ rating: feedback.rating, resolutionStatus: feedback.resolutionStatus })
        .from(feedback)
        .innerJoin(issues, eq(feedback.issueId, issues.id))
        .where(eq(issues.departmentId, departmentId))
    : await db.select({ rating: feedback.rating, resolutionStatus: feedback.resolutionStatus }).from(feedback);
  const reopened = departmentId
    ? await db
        .select({ n: count() })
        .from(issues)
        .where(and(eq(issues.departmentId, departmentId), sql`${issues.reopenCount} > 0`))
    : await db.select({ n: count() }).from(issues).where(sql`${issues.reopenCount} > 0`);
  const totalIssuesRows = departmentId
    ? await db.select({ n: count() }).from(issues).where(eq(issues.departmentId, departmentId))
    : await db.select({ n: count() }).from(issues);
  const avg = fbRows.length
    ? fbRows.reduce((s, f) => s + f.rating, 0) / fbRows.length
    : 0;
  return {
    count: fbRows.length,
    averageRating: Math.round(avg * 10) / 10,
    resolvedYes: fbRows.filter((f) => f.resolutionStatus === "YES").length,
    resolvedPartially: fbRows.filter((f) => f.resolutionStatus === "PARTIALLY").length,
    resolvedNo: fbRows.filter((f) => f.resolutionStatus === "NO").length,
    reopenRate: (totalIssuesRows[0]?.n ?? 0)
      ? (reopened[0]?.n ?? 0) / (totalIssuesRows[0]?.n ?? 1)
      : 0,
  };
}

/** Zone heatmap data (spec §48). */
export async function getZoneHeatmap(): Promise<{ zone: string; total: number; open: number; road: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({
      zone: sql<string>`coalesce(${issues.zone}, ${issues.locality}, 'Unspecified')`,
      status: issues.status,
      categoryId: issues.categoryId,
    })
    .from(issues)
    .where(eq(issues.isPublic, true));
  const roadCats = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.slug, ["road-damage", "footpath", "traffic-signal"]));
  const roadIds = new Set(roadCats.map((c) => c.id));
  const map = new Map<string, { zone: string; total: number; open: number; road: number }>();
  for (const r of rows) {
    const z = String(r.zone ?? "Unspecified");
    const entry = map.get(z) ?? { zone: z, total: 0, open: 0, road: 0 };
    entry.total++;
    if (OPEN_STATUSES.includes(r.status)) entry.open++;
    if (roadIds.has(r.categoryId)) entry.road++;
    map.set(z, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/**
 * Hotspot detection (spec §49): grid cells (~800 m) with an unusual density
 * of recent reports. Returns actionable hotspots with their dominant category.
 */
export async function detectHotspots(days = 7, minCount = 4): Promise<{
  label: string;
  latitude: number;
  longitude: number;
  count: number;
  topCategory: string;
  radiusMeters: number;
}[]> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      latitude: issues.latitude,
      longitude: issues.longitude,
      locality: issues.locality,
      zone: issues.zone,
      categoryName: categories.name,
    })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(and(gte(issues.createdAt, since), eq(issues.isPublic, true)));

  const grid = 0.0075; // ~800m
  const cells = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${Math.floor(r.latitude / grid)}:${Math.floor(r.longitude / grid)}`;
    const cell = cells.get(key) ?? [];
    cell.push(r);
    cells.set(key, cell);
  }
  const hotspots = [...cells.values()]
    .filter((cell) => cell.length >= minCount)
    .map((cell) => {
      const lat = cell.reduce((s, r) => s + r.latitude, 0) / cell.length;
      const lng = cell.reduce((s, r) => s + r.longitude, 0) / cell.length;
      const catCounts = new Map<string, number>();
      for (const r of cell) catCounts.set(r.categoryName, (catCounts.get(r.categoryName) ?? 0) + 1);
      const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const label = cell[0]!.zone ?? cell[0]!.locality ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      return {
        label,
        latitude: Math.round(lat * 1e4) / 1e4,
        longitude: Math.round(lng * 1e4) / 1e4,
        count: cell.length,
        topCategory,
        radiusMeters: 800,
      };
    })
    .sort((a, b) => b.count - a.count);
  return hotspots.slice(0, 8);
}

/** Authority dashboard counters (spec §34). */
export async function getAuthorityCounters(departmentId?: string | null) {
  const db = await getDb();
  const cond = departmentId ? eq(issues.departmentId, departmentId) : undefined;
  const rows = await db
    .select({
      status: issues.status,
      priority: issues.priority,
      isOverdue: issues.isOverdue,
      createdAt: issues.createdAt,
      resolvedAt: issues.resolvedAt,
    })
    .from(issues)
    .where(cond);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const pendingVerification = rows.filter((r) =>
    ["SUBMITTED", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"].includes(r.status)
  ).length;
  return {
    totalAssigned: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    pendingVerification,
    inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
    overdue: rows.filter((r) => r.isOverdue && OPEN_STATUSES.includes(r.status)).length,
    criticalOpen: rows.filter((r) => r.priority === "CRITICAL" && OPEN_STATUSES.includes(r.status)).length,
    resolvedThisMonth: rows.filter((r) => r.resolvedAt && r.resolvedAt >= monthAgo).length,
  };
}

/** Community page data (spec §94). */
export async function getCommunityData() {
  const db = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [trending, recentlyResolved] = await Promise.all([
    db
      .select({
        publicId: issues.publicId,
        title: issues.title,
        upvotesCount: issues.upvotesCount,
        status: issues.status,
        priority: issues.priority,
        locality: issues.locality,
        createdAt: issues.createdAt,
        categoryName: categories.name,
      })
      .from(issues)
      .innerJoin(categories, eq(issues.categoryId, categories.id))
      .where(and(eq(issues.isPublic, true), eq(issues.isHidden, false), gte(issues.createdAt, weekAgo)))
      .orderBy(desc(issues.upvotesCount), desc(issues.commentsCount))
      .limit(6),
    db
      .select({
        publicId: issues.publicId,
        title: issues.title,
        resolvedAt: issues.resolvedAt,
        locality: issues.locality,
        createdAt: issues.createdAt,
        categoryName: categories.name,
      })
      .from(issues)
      .innerJoin(categories, eq(issues.categoryId, categories.id))
      .where(and(eq(issues.isPublic, true), sql`${issues.resolvedAt} IS NOT NULL`))
      .orderBy(desc(issues.resolvedAt))
      .limit(6),
  ]);
  return { trending, recentlyResolved };
}
