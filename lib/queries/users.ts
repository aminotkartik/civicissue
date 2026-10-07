/**
 * User registration, lookup and admin management (spec §85).
 */
import { and, desc, eq, like, or, sql, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, workers, departments, issues, comments, upvotes, confirmations } from "@/drizzle/sqlite/schema";
import { hashPassword } from "@/lib/auth";
import { uuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import type { UserRole } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";
import { ActionError } from "@/lib/queries/issue-actions";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  city: string;
  locality?: string | null;
}

export async function registerUser(input: RegisterInput) {
  const db = await getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()))
    .limit(1);
  if (existing[0]) {
    throw new ActionError("An account with this email already exists. Try logging in.", 409);
  }
  const id = uuid();
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: "CITIZEN",
    phone: input.phone || null,
    city: input.city,
    locality: input.locality || null,
  });
  await recordAudit({ id, email: input.email }, "USER_REGISTERED", "USER", id);
  return id;
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserByGoogleId(googleId: string) {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return rows[0] ?? null;
}

export async function linkOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
}) {
  const db = await getDb();
  const existing = await findUserByEmail(profile.email);
  if (existing) {
    await db.update(users).set({ googleId: profile.googleId }).where(eq(users.id, existing.id));
    return existing;
  }
  const id = uuid();
  await db.insert(users).values({
    id,
    name: profile.name,
    email: profile.email.toLowerCase(),
    googleId: profile.googleId,
    role: "CITIZEN",
    city: "",
  });
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Admin management
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  city: string | null;
  locality: string | null;
  departmentId: string | null;
  isActive: boolean;
  isSuspended: boolean;
  trustScore: number;
  createdAt: Date;
  reportCount: number;
  departmentName: string | null;
}

export async function listUsersForAdmin(opts: {
  q?: string;
  role?: UserRole;
  suspended?: "yes" | "no";
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminUserRow[]; total: number }> {
  const db = await getDb();
  const page = opts.page ?? 1;
  const pageSize = Math.min(50, opts.pageSize ?? 20);
  const conditions = [];
  if (opts.role) conditions.push(eq(users.role, opts.role));
  if (opts.suspended === "yes") conditions.push(eq(users.isSuspended, true));
  if (opts.suspended === "no") conditions.push(eq(users.isSuspended, false));
  if (opts.q) {
    const pattern = `%${opts.q.toLowerCase().replace(/[%_]/g, "")}%`;
    conditions.push(
      or(
        like(sql`lower(${users.name})`, pattern),
        like(sql`lower(${users.email})`, pattern)
      )!
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      user: users,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ n: count() }).from(users).where(where);

  const items = await Promise.all(
    rows.map(async (r) => {
      const rc = await db
        .select({ n: count() })
        .from(issues)
        .where(eq(issues.createdById, r.user.id));
      return {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        role: r.user.role,
        city: r.user.city,
        locality: r.user.locality,
        departmentId: r.user.departmentId,
        isActive: r.user.isActive,
        isSuspended: r.user.isSuspended,
        trustScore: r.user.trustScore,
        createdAt: r.user.createdAt,
        reportCount: rc[0]?.n ?? 0,
        departmentName: r.departmentName,
      };
    })
  );
  return { items, total: totalRows[0]?.n ?? 0 };
}

export async function adminUpdateUser(
  actor: CurrentUser,
  targetId: string,
  patch: {
    role?: UserRole;
    isSuspended?: boolean;
    suspensionReason?: string | null;
    departmentId?: string | null;
    isActive?: boolean;
  }
): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  const target = rows[0];
  if (!target) throw new ActionError("User not found.", 404);
  if (target.id === actor.id && (patch.isSuspended || patch.role)) {
    throw new ActionError("You cannot suspend or change your own role.");
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.role) set.role = patch.role;
  if (patch.isSuspended !== undefined) {
    set.isSuspended = patch.isSuspended;
    set.suspensionReason = patch.isSuspended ? patch.suspensionReason ?? null : null;
  }
  if (patch.departmentId !== undefined) set.departmentId = patch.departmentId || null;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  await db.update(users).set(set).where(eq(users.id, targetId));

  // Keep worker record department in sync when a worker's dept changes.
  if (patch.departmentId !== undefined) {
    await db
      .update(workers)
      .set({ departmentId: patch.departmentId || undefined })
      .where(and(eq(workers.userId, targetId), sql`${patch.departmentId} IS NOT NULL`));
  }
  await recordAudit(
    { id: actor.id, email: actor.email },
    patch.isSuspended ? "USER_SUSPENDED" : patch.role ? "USER_ROLE_CHANGED" : "USER_UPDATED",
    "USER",
    targetId,
    patch as Record<string, unknown>
  );
}

export async function getUserPublicStats(userId: string) {
  const db = await getDb();
  const [reports, resolved, commentsN, upvotesN, confirmsN] = await Promise.all([
    db.select({ n: count() }).from(issues).where(eq(issues.createdById, userId)),
    db
      .select({ n: count() })
      .from(issues)
      .where(and(eq(issues.createdById, userId), sql`${issues.resolvedAt} IS NOT NULL`)),
    db.select({ n: count() }).from(comments).where(eq(comments.userId, userId)),
    db.select({ n: count() }).from(upvotes).where(eq(upvotes.userId, userId)),
    db.select({ n: count() }).from(confirmations).where(eq(confirmations.userId, userId)),
  ]);
  return {
    reports: reports[0]?.n ?? 0,
    resolvedReports: resolved[0]?.n ?? 0,
    comments: commentsN[0]?.n ?? 0,
    upvotes: upvotesN[0]?.n ?? 0,
    confirmations: confirmsN[0]?.n ?? 0,
  };
}

/** Contribution badge labels (subtle recognition — spec §149). */
export function contributionBadges(stats: {
  reports: number;
  resolvedReports: number;
  confirmations: number;
  comments: number;
}): string[] {
  const badges: string[] = [];
  if (stats.reports >= 1) badges.push("Helpful reporter");
  if (stats.confirmations >= 3) badges.push("Community verifier");
  if (stats.resolvedReports >= 3) badges.push("Resolution contributor");
  if (stats.comments >= 5) badges.push("Active neighbour");
  return badges;
}
