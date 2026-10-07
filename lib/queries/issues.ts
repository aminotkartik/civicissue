/**
 * Issue read models + creation (the write-side of the issue lifecycle lives
 * in lib/queries/issue-actions.ts). All functions are server-only.
 */
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  ne,
  or,
  sql,
  asc,
  count,
} from "drizzle-orm";
import { getDb, withTransaction } from "@/lib/db";
import {
  issues,
  issueImages,
  issueEvents,
  issueStatusHistory,
  categories,
  departments,
  workers,
  users,
  upvotes,
  follows,
  confirmations,
  comments,
  feedback,
} from "@/drizzle/sqlite/schema";
import { nextPublicId, uuid } from "@/lib/ids";
import { computePriority } from "@/lib/priority/engine";
import { computeSlaDeadline, isOverdue } from "@/lib/sla/engine";
import { getPriorityWeights, getSlaDefaults } from "@/lib/queries/settings";
import { obscureCoordinate } from "@/lib/maps/geo";
import { notify } from "@/lib/notifications";
import { recordAudit } from "@/lib/audit";
import { getCategoryBySlug } from "@/lib/queries/references";
import {
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  type IssueCardData,
  type IssueStatus,
  type Priority,
  type UserRole,
} from "@/lib/types";
import type { CreateIssueInput, ListIssuesQuery } from "@/lib/validation";
import type { CurrentUser } from "@/lib/auth";
import { hasDepartmentScope } from "@/lib/permissions/matrix";

// ---------------------------------------------------------------------------
// Card projection
// ---------------------------------------------------------------------------

export function publicCoordinates(issue: {
  id: string;
  latitude: number;
  longitude: number;
  locationPrivacy: "EXACT" | "APPROXIMATE";
}): { latitude: number; longitude: number; obscured: boolean } {
  if (issue.locationPrivacy === "APPROXIMATE") {
    const o = obscureCoordinate(issue.latitude, issue.longitude, issue.id);
    return { ...o, obscured: true };
  }
  return {
    latitude: issue.latitude,
    longitude: issue.longitude,
    obscured: false,
  };
}

/** True when the viewer may see the exact location & reporter details. */
export function canSeeExactLocation(
  issue: { createdById: string; locationPrivacy: string; departmentId?: string | null },
  viewer: CurrentUser | null,
  isAssignedWorker = false
): boolean {
  // EXACT is an explicit public-sharing choice made by the reporter.
  if (issue.locationPrivacy === "EXACT") return true;
  if (!viewer) return false;
  if (viewer.id === issue.createdById || viewer.role === "ADMIN") return true;
  if (viewer.role === "AUTHORITY") {
    return hasDepartmentScope(viewer.departmentId, issue.departmentId);
  }
  return viewer.role === "WORKER" && isAssignedWorker;
}

interface CardRow {
  id: string;
  publicId: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  priorityScore: number;
  locality: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  locationPrivacy: "EXACT" | "APPROXIMATE";
  upvotesCount: number;
  commentsCount: number;
  confirmationsCount: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  categoryName: string;
  categoryIcon: string;
  departmentName: string | null;
  coverImage: string | null;
}

function toCard(row: CardRow): IssueCardData {
  const coords = publicCoordinates(row);
  return {
    id: row.id,
    publicId: row.publicId,
    title: row.title,
    category: row.categoryName,
    categoryIcon: row.categoryIcon,
    status: row.status,
    priority: row.priority,
    priorityScore: row.priorityScore,
    locality: row.locality,
    city: row.city,
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationPrivacy: row.locationPrivacy,
    upvotesCount: row.upvotesCount,
    commentsCount: row.commentsCount,
    confirmationsCount: row.confirmationsCount,
    coverImage: row.coverImage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    departmentName: row.departmentName,
  };
}

// ---------------------------------------------------------------------------
// Listing with filters, sorting and pagination (spec §28, §29, §79)
// ---------------------------------------------------------------------------

export interface ListIssuesOptions {
  query: ListIssuesQuery;
  viewer?: CurrentUser | null;
  /** "public" hides drafts/rejected/hidden; "mine" scopes to the viewer. */
  scope?: "public" | "mine" | "staff";
  /** Restrict to a department (authority dashboards). */
  departmentId?: string | null;
  /** Restrict to a worker (worker dashboards). */
  workerId?: string | null;
}

export interface ListIssuesResult {
  items: IssueCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listIssues(
  opts: ListIssuesOptions
): Promise<ListIssuesResult> {
  const db = await getDb();
  const { query, viewer, scope = "public" } = opts;
  const conditions = [];

  if (scope === "public") {
    conditions.push(eq(issues.isPublic, true));
    conditions.push(eq(issues.isHidden, false));
    conditions.push(ne(issues.status, "DRAFT"));
    conditions.push(ne(issues.status, "REJECTED"));
  } else if (scope === "mine") {
    if (!viewer) return { items: [], total: 0, page: 1, pageSize: query.pageSize, totalPages: 0 };
    conditions.push(eq(issues.createdById, viewer.id));
  }
  if (scope === "staff") {
    conditions.push(eq(issues.isHidden, false));
  }
  if (opts.departmentId) conditions.push(eq(issues.departmentId, opts.departmentId));
  if (opts.workerId) conditions.push(eq(issues.assignedWorkerId, opts.workerId));

  if (query.status) {
    conditions.push(eq(issues.status, query.status));
  } else if (query.statuses) {
    const list = query.statuses.split(",").filter(Boolean) as IssueStatus[];
    if (list.length) conditions.push(inArray(issues.status, list));
  }
  if (query.priority) conditions.push(eq(issues.priority, query.priority));
  if (query.category) {
    const cat = await getCategoryBySlug(query.category);
    if (cat) conditions.push(eq(issues.categoryId, cat.id));
    else conditions.push(sql`1=0`);
  }
  if (query.locality)
    conditions.push(like(sql`lower(${issues.locality})`, `%${query.locality.toLowerCase()}%`));
  if (query.city)
    conditions.push(like(sql`lower(${issues.city})`, `%${query.city.toLowerCase()}%`));
  if (query.pincode) conditions.push(eq(issues.pincode, query.pincode));
  if (query.departmentId) conditions.push(eq(issues.departmentId, query.departmentId));
  if (query.workerId) conditions.push(eq(issues.assignedWorkerId, query.workerId));

  // Date range filters
  let since: Date | null = null;
  let until: Date | null = null;
  if (query.range === "today") since = startOfToday();
  if (query.range === "week") since = new Date(Date.now() - 7 * 86400_000);
  if (query.range === "month") since = new Date(Date.now() - 30 * 86400_000);
  if (query.dateFrom) since = new Date(query.dateFrom);
  if (query.dateTo) until = new Date(query.dateTo + "T23:59:59");
  if (since) conditions.push(gte(issues.createdAt, since));
  if (until) conditions.push(lte(issues.createdAt, until));

  // SLA filter
  if (query.sla === "overdue") {
    conditions.push(eq(issues.isOverdue, true));
    conditions.push(inArray(issues.status, [...OPEN_STATUSES]));
  } else if (query.sla === "due-soon") {
    conditions.push(inArray(issues.status, [...OPEN_STATUSES]));
    conditions.push(lte(issues.slaDeadline, new Date(Date.now() + 12 * 3600_000)));
    conditions.push(gte(issues.slaDeadline, new Date()));
  }

  // Text search — ID exact match OR text contains (indexed columns, bounded page)
  if (query.q) {
    const q = query.q.trim();
    if (/^CIV-\d{4}-\d{6}$/i.test(q)) {
      conditions.push(eq(issues.publicId, q.toUpperCase()));
    } else {
      const pattern = `%${q.toLowerCase().replace(/[%_]/g, "")}%`;
      conditions.push(
        or(
          like(sql`lower(${issues.title})`, pattern),
          like(sql`lower(${issues.description})`, pattern),
          like(sql`lower(${issues.locality})`, pattern),
          like(sql`lower(${issues.city})`, pattern),
          like(sql`lower(${issues.pincode})`, pattern),
          like(sql`lower(${categories.name})`, pattern)
        )!
      );
    }
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = {
    newest: desc(issues.createdAt),
    oldest: asc(issues.createdAt),
    priority: desc(issues.priorityScore),
    updated: desc(issues.updatedAt),
    support: desc(issues.upvotesCount),
  }[query.sort ?? "newest"];

  const offset = (query.page - 1) * query.pageSize;

  const rows = await db
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
      departmentName: departments.name,
    })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .leftJoin(departments, eq(issues.departmentId, departments.id))
    .where(where)
    .orderBy(orderBy, desc(issues.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  // Cover images: one bounded follow-up query for the current page only.
  const pageIds = rows.map((r) => r.id);
  const coverMap = new Map<string, string>();
  if (pageIds.length) {
    const imgRows = await db
      .select({ issueId: issueImages.issueId, url: issueImages.url, sortOrder: issueImages.sortOrder })
      .from(issueImages)
      .where(inArray(issueImages.issueId, pageIds))
      .orderBy(asc(issueImages.sortOrder));
    for (const img of imgRows) {
      if (!coverMap.has(img.issueId)) coverMap.set(img.issueId, img.url);
    }
  }

  const totalRows = await db
    .select({ n: count() })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(where);
  const total = totalRows[0]?.n ?? 0;

  return {
    items: rows.map((r) =>
      toCard({ ...r, coverImage: coverMap.get(r.id) ?? null })
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface IssueDetail {
  issue: typeof issues.$inferSelect;
  category: typeof categories.$inferSelect;
  department: (typeof departments.$inferSelect & { workerCount?: number }) | null;
  worker: { id: string; name: string; employeeId: string; zone: string | null } | null;
  reporter: { id: string; name: string; createdAt: Date; trustScore: number } | null;
  images: (typeof issueImages.$inferSelect & { uploadedByName: string | null })[];
  events: (typeof issueEvents.$inferSelect & { actorName: string | null })[];
  statusHistory: typeof issueStatusHistory.$inferSelect[];
  commentsList: {
    id: string;
    content: string;
    createdAt: Date;
    isHidden: boolean;
    user: { id: string; name: string; role: UserRole; profileImage: string | null };
  }[];
  feedbackList: (typeof feedback.$inferSelect & { userName: string | null })[];
  viewerState: {
    upvoted: boolean;
    following: boolean;
    confirmed: boolean;
    hasFeedback: boolean;
    isReporter: boolean;
    canSeeExact: boolean;
    canSeeStaffDetails: boolean;
  };
  duplicateOf?: { publicId: string; title: string } | null;
}

export async function getIssueDetail(
  publicIdOrId: string,
  viewer: CurrentUser | null
): Promise<IssueDetail | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(issues)
    .where(
      or(eq(issues.publicId, publicIdOrId.toUpperCase()), eq(issues.id, publicIdOrId))
    )
    .limit(1);
  const issue = rows[0];
  if (!issue) return null;

  const isReporter = viewer?.id === issue.createdById;
  let isAssignedWorker = false;
  if (viewer?.role === "WORKER" && issue.assignedWorkerId) {
    const workerRows = await db.select({ id: workers.id }).from(workers)
      .where(and(eq(workers.id, issue.assignedWorkerId), eq(workers.userId, viewer.id), eq(workers.active, true)))
      .limit(1);
    isAssignedWorker = workerRows.length > 0;
  }
  const isStaff = !!viewer && (
    viewer.role === "ADMIN" ||
    (viewer.role === "AUTHORITY" && hasDepartmentScope(viewer.departmentId, issue.departmentId)) ||
    (viewer.role === "WORKER" && isAssignedWorker)
  );
  // Visibility: public issues are visible to all; hidden ones only to scoped staff.
  if (issue.isHidden && !isStaff) return null;
  // Rejected/draft issues are only visible to their reporter and staff.
  if (
    (issue.status === "REJECTED" || issue.status === "DRAFT") &&
    !isStaff &&
    !isReporter
  ) {
    return null;
  }

  const [catRows, deptRows, workerRows, reporterRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.id, issue.categoryId)).limit(1),
    issue.departmentId
      ? db.select().from(departments).where(eq(departments.id, issue.departmentId)).limit(1)
      : Promise.resolve([]),
    issue.assignedWorkerId
      ? db
          .select({
            id: workers.id,
            name: users.name,
            employeeId: workers.employeeId,
            zone: workers.zone,
          })
          .from(workers)
          .innerJoin(users, eq(workers.userId, users.id))
          .where(eq(workers.id, issue.assignedWorkerId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: users.id,
        name: users.name,
        createdAt: users.createdAt,
        trustScore: users.trustScore,
      })
      .from(users)
      .where(eq(users.id, issue.createdById))
      .limit(1),
  ]);

  const [imageRows, eventRows, historyRows, commentRows, feedbackRows] =
    await Promise.all([
      db
        .select({
          image: issueImages,
          uploadedByName: users.name,
        })
        .from(issueImages)
        .leftJoin(users, eq(issueImages.uploadedById, users.id))
        .where(eq(issueImages.issueId, issue.id))
        .orderBy(asc(issueImages.sortOrder), asc(issueImages.createdAt)),
      db
        .select({ event: issueEvents, actorName: users.name })
        .from(issueEvents)
        .leftJoin(users, eq(issueEvents.actorId, users.id))
        .where(eq(issueEvents.issueId, issue.id))
        .orderBy(asc(issueEvents.createdAt)),
      db
        .select()
        .from(issueStatusHistory)
        .where(eq(issueStatusHistory.issueId, issue.id))
        .orderBy(asc(issueStatusHistory.createdAt)),
      db
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          isHidden: comments.isHidden,
          userId: users.id,
          name: users.name,
          role: users.role,
          profileImage: users.profileImage,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.issueId, issue.id))
        .orderBy(desc(comments.createdAt)),
      db
        .select({ fb: feedback, userName: users.name })
        .from(feedback)
        .leftJoin(users, eq(feedback.userId, users.id))
        .where(eq(feedback.issueId, issue.id))
        .orderBy(desc(feedback.createdAt)),
    ]);

  let viewerState = {
    upvoted: false,
    following: false,
    confirmed: false,
    hasFeedback: false,
    isReporter: !!isReporter,
    canSeeExact: canSeeExactLocation(issue, viewer, isAssignedWorker),
    canSeeStaffDetails: isStaff,
  };
  if (viewer) {
    const [uv, fl, cf, fbk] = await Promise.all([
      db.select({ id: upvotes.id }).from(upvotes)
        .where(and(eq(upvotes.issueId, issue.id), eq(upvotes.userId, viewer.id))).limit(1),
      db.select({ id: follows.id }).from(follows)
        .where(and(eq(follows.issueId, issue.id), eq(follows.userId, viewer.id))).limit(1),
      db.select({ id: confirmations.id }).from(confirmations)
        .where(and(eq(confirmations.issueId, issue.id), eq(confirmations.userId, viewer.id))).limit(1),
      db.select({ id: feedback.id }).from(feedback)
        .where(and(eq(feedback.issueId, issue.id), eq(feedback.userId, viewer.id))).limit(1),
    ]);
    viewerState = {
      ...viewerState,
      upvoted: uv.length > 0,
      following: fl.length > 0,
      confirmed: cf.length > 0,
      hasFeedback: fbk.length > 0,
    };
  }

  // Hide internal comments from public viewers when flagged.
  const visibleComments = commentRows
    .filter((c) => isStaff || !c.isHidden)
    .map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      isHidden: c.isHidden,
      user: { id: c.userId, name: c.name, role: c.role, profileImage: c.profileImage },
    }));

  const visibleEvents = eventRows
    .filter((e) => (isStaff || isReporter ? true : e.event.isPublic))
    .map((e) => ({ ...e.event, actorName: e.actorName }));

  let duplicateOf: { publicId: string; title: string } | null = null;
  const dupTarget = issue.mergedIntoId ?? issue.duplicateOfId;
  if (issue.isDuplicate && dupTarget) {
    const dup = await db
      .select({ publicId: issues.publicId, title: issues.title })
      .from(issues)
      .where(eq(issues.id, dupTarget))
      .limit(1);
    duplicateOf = dup[0] ?? null;
  }

  return {
    issue,
    category: catRows[0]!,
    department: deptRows[0] ?? null,
    worker: workerRows[0] ?? null,
    reporter: reporterRows[0] ?? null,
    images: imageRows.map((r) => ({ ...r.image, uploadedByName: r.uploadedByName })),
    events: visibleEvents,
    statusHistory: historyRows,
    commentsList: visibleComments,
    feedbackList: feedbackRows.map((r) => ({ ...r.fb, userName: r.userName })),
    viewerState,
    duplicateOf,
  };
}

// ---------------------------------------------------------------------------
// Creation (spec §21, §118 — transactional)
// ---------------------------------------------------------------------------

export interface CreateIssueResult {
  issueId: string;
  publicId: string;
  priority: Priority;
  priorityScore: number;
  priorityExplanation: string;
  slaDeadline: Date;
}

export async function createIssue(
  input: CreateIssueInput,
  user: CurrentUser,
  meta?: { ip?: string | null }
): Promise<CreateIssueResult> {
  const category = await getCategoryBySlug(input.categorySlug);
  if (!category || !category.active) {
    throw new Error("Please choose a valid category.");
  }

  const now = new Date();
  const [priorityWeights, slaDefaults] = await Promise.all([getPriorityWeights(), getSlaDefaults()]);
  const priorityResult = computePriority({
    severity: input.severity,
    categorySlug: category.slug,
    title: input.title,
    description: input.description,
    locality: input.locality ?? null,
    weights: priorityWeights,
  });
  const slaDeadline = computeSlaDeadline(now, priorityResult.priority, category, slaDefaults);

  const publicId = await nextPublicId();
  const issueId = uuid();

  await withTransaction(async (tx) => {
    await tx.insert(issues).values({
      id: issueId,
      publicId,
      title: input.title,
      description: input.description,
      categoryId: category.id,
      status: "SUBMITTED",
      severity: input.severity,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      priorityExplanation: priorityResult.explanation,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address ?? null,
      city: input.city ?? user.city,
      state: input.state ?? null,
      pincode: input.pincode || null,
      locality: input.locality ?? user.locality,
      zone: input.zone ?? null,
      locationPrivacy: input.locationPrivacy,
      createdById: user.id,
      departmentId: category.defaultDepartmentId ?? null,
      isPublic: input.isPublic,
      aiCategory: input.aiCategory ?? null,
      aiConfidence: input.aiConfidence ?? null,
      aiSeverity: input.aiSeverity ?? null,
      aiObservations: input.aiObservations
        ? JSON.stringify(input.aiObservations)
        : null,
      aiProvider: input.aiCategory ? (process.env.AI_PROVIDER ?? "local-heuristic") : null,
      slaDeadline,
    });

    // Attach already-uploaded images (keys → served URLs).
    for (let i = 0; i < input.imageKeys.length; i++) {
      await tx.insert(issueImages).values({
        id: uuid(),
        issueId,
        url: fileKeyToUrl(input.imageKeys[i]!),
        type: "BEFORE",
        sortOrder: i,
        uploadedById: user.id,
      });
    }

    await tx.insert(issueStatusHistory).values({
      id: uuid(),
      issueId,
      fromStatus: null,
      toStatus: "SUBMITTED",
      changedById: user.id,
      reason: null,
    });

    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId,
      type: "SUBMITTED",
      actorId: user.id,
      actorRole: user.role,
      message: `Report submitted by ${user.name}`,
      isPublic: true,
    });

    if (input.aiCategory) {
      await tx.insert(issueEvents).values({
        id: uuid(),
        issueId,
        type: "AI_CATEGORIZED",
        actorId: null,
        actorRole: "SYSTEM",
        message: `AI assistant suggested category "${category.name}"${
          input.aiConfidence != null
            ? ` with ${Math.round(input.aiConfidence * 100)}% confidence`
            : ""
        }`,
        isPublic: true,
        metadata: JSON.stringify({
          aiCategory: input.aiCategory,
          aiConfidence: input.aiConfidence ?? null,
        }),
      });
    }

    await tx.insert(issueEvents).values({
      id: uuid(),
      issueId,
      type: "PRIORITY_COMPUTED",
      actorId: null,
      actorRole: "SYSTEM",
      message: `Priority computed: ${priorityResult.priority} (score ${priorityResult.score}/100)`,
      isPublic: true,
      metadata: JSON.stringify({ factors: priorityResult.factors }),
    });

    if (category.defaultDepartmentId) {
      const dept = await tx
        .select({ name: departments.name })
        .from(departments)
        .where(eq(departments.id, category.defaultDepartmentId))
        .limit(1);
      if (dept[0]) {
        await tx.insert(issueEvents).values({
          id: uuid(),
          issueId,
          type: "ROUTED",
          actorId: null,
          actorRole: "SYSTEM",
          message: `Automatically routed to ${dept[0].name}`,
          isPublic: true,
        });
      }
    }

    // Trust score: +10 per report (spec §93).
    await tx
      .update(users)
      .set({ trustScore: sql`${users.trustScore} + 10` })
      .where(eq(users.id, user.id));
  });

  await notify({
    userId: user.id,
    type: "ISSUE_SUBMITTED",
    title: "Your report has been submitted",
    message: `We've received your complaint ${publicId}. It is now waiting for authority review.`,
    issueId,
    link: `/issues/${publicId}`,
    email: true,
  });

  await recordAudit(
    { id: user.id, email: user.email },
    "ISSUE_CREATED",
    "ISSUE",
    issueId,
    { publicId, priority: priorityResult.priority, score: priorityResult.score },
    meta?.ip
  );

  return {
    issueId,
    publicId,
    priority: priorityResult.priority,
    priorityScore: priorityResult.score,
    priorityExplanation: priorityResult.explanation,
    slaDeadline,
  };
}

export function fileKeyToUrl(key: string): string {
  if (key.startsWith("/api/files/") || key.startsWith("http")) return key;
  return `/api/files/${key.replace(/^\/+/, "")}`;
}

// ---------------------------------------------------------------------------
// Nearby & map queries (spec §26, §27)
// ---------------------------------------------------------------------------

export async function listNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  limit = 30
): Promise<(IssueCardData & { distanceKm: number })[]> {
  const db = await getDb();
  const { boundingBox, haversineKm } = await import("@/lib/maps/geo");
  const box = boundingBox(lat, lng, radiusKm);
  const rows = await db
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
      departmentName: departments.name,
    })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .leftJoin(departments, eq(issues.departmentId, departments.id))
    .where(
      and(
        eq(issues.isPublic, true),
        eq(issues.isHidden, false),
        inArray(issues.status, [...OPEN_STATUSES, ...RESOLVED_STATUSES]),
        gte(issues.latitude, box.minLat),
        lte(issues.latitude, box.maxLat),
        gte(issues.longitude, box.minLng),
        lte(issues.longitude, box.maxLng)
      )
    )
    .limit(200);

  return rows
    .map((r) => {
      const coords = publicCoordinates(r);
      return {
        ...toCard({ ...r, coverImage: null }),
        latitude: coords.latitude,
        longitude: coords.longitude,
        distanceKm: haversineKm(lat, lng, coords.latitude, coords.longitude),
      };
    })
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export interface MapIssuePoint {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryIcon: string;
  status: IssueStatus;
  priority: Priority;
  latitude: number;
  longitude: number;
  locality: string | null;
  upvotesCount: number;
  createdAt: Date;
}

export async function listMapIssues(opts: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  statuses?: IssueStatus[];
  categorySlug?: string;
  priority?: Priority;
  limit?: number;
}): Promise<MapIssuePoint[]> {
  const db = await getDb();
  const conditions = [
    eq(issues.isPublic, true),
    eq(issues.isHidden, false),
    ne(issues.status, "DRAFT"),
    gte(issues.latitude, opts.minLat),
    lte(issues.latitude, opts.maxLat),
    gte(issues.longitude, opts.minLng),
    lte(issues.longitude, opts.maxLng),
  ];
  if (opts.statuses?.length) conditions.push(inArray(issues.status, opts.statuses));
  if (opts.priority) conditions.push(eq(issues.priority, opts.priority));
  let categoryJoin;
  if (opts.categorySlug) {
    const cat = await getCategoryBySlug(opts.categorySlug);
    if (cat) conditions.push(eq(issues.categoryId, cat.id));
    else return [];
  }
  void categoryJoin;

  const rows = await db
    .select({
      id: issues.id,
      publicId: issues.publicId,
      title: issues.title,
      status: issues.status,
      priority: issues.priority,
      latitude: issues.latitude,
      longitude: issues.longitude,
      locationPrivacy: issues.locationPrivacy,
      locality: issues.locality,
      upvotesCount: issues.upvotesCount,
      createdAt: issues.createdAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(issues)
    .innerJoin(categories, eq(issues.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(issues.priorityScore))
    .limit(opts.limit ?? 500);

  return rows.map((r) => {
    const coords = publicCoordinates(r);
    return {
      id: r.id,
      publicId: r.publicId,
      title: r.title,
      category: r.categoryName,
      categoryIcon: r.categoryIcon,
      status: r.status,
      priority: r.priority,
      latitude: coords.latitude,
      longitude: coords.longitude,
      locality: r.locality,
      upvotesCount: r.upvotesCount,
      createdAt: r.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Freshness polling for near-real-time updates (spec §74 polling fallback)
// ---------------------------------------------------------------------------

export async function getIssueFreshness(publicId: string): Promise<{
  updatedAt: number;
  status: IssueStatus;
  upvotesCount: number;
  commentsCount: number;
} | null> {
  const db = await getDb();
  const rows = await db
    .select({
      updatedAt: issues.updatedAt,
      status: issues.status,
      upvotesCount: issues.upvotesCount,
      commentsCount: issues.commentsCount,
    })
    .from(issues)
    .where(eq(issues.publicId, publicId.toUpperCase()))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    updatedAt: r.updatedAt.getTime(),
    status: r.status,
    upvotesCount: r.upvotesCount,
    commentsCount: r.commentsCount,
  };
}

export { isOverdue };
