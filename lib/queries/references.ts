/**
 * Reference data queries: categories, departments, workers.
 * Cached per-request via React `cache` where used in server components.
 */
import { cache } from "react";
import { and, eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  categories,
  departments,
  workers,
  users,
  issues,
} from "@/drizzle/sqlite/schema";

export const getActiveCategories = cache(async () => {
  const db = await getDb();
  return db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.name));
});

export const getAllCategories = cache(async () => {
  const db = await getDb();
  return db.select().from(categories).orderBy(asc(categories.name));
});

export const getCategoryBySlug = cache(async (slug: string) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
});

export const getActiveDepartments = cache(async () => {
  const db = await getDb();
  return db
    .select()
    .from(departments)
    .where(eq(departments.active, true))
    .orderBy(asc(departments.name));
});

export const getAllDepartments = cache(async () => {
  const db = await getDb();
  return db.select().from(departments).orderBy(asc(departments.name));
});

export interface WorkerWithLoad {
  id: string;
  name: string;
  employeeId: string;
  zone: string | null;
  departmentId: string;
  departmentName: string;
  active: boolean;
  assigned: number;
  inProgress: number;
  overdue: number;
}

export const getWorkersWithLoad = cache(
  async (departmentId?: string | null): Promise<WorkerWithLoad[]> => {
    const db = await getDb();
    const rows = await db
      .select({
        id: workers.id,
        userId: workers.userId,
        employeeId: workers.employeeId,
        zone: workers.zone,
        departmentId: workers.departmentId,
        active: workers.active,
        name: users.name,
        departmentName: departments.name,
      })
      .from(workers)
      .innerJoin(users, eq(workers.userId, users.id))
      .innerJoin(departments, eq(workers.departmentId, departments.id))
      .orderBy(asc(users.name));

    const filtered = departmentId
      ? rows.filter((r) => r.departmentId === departmentId)
      : rows;

    return Promise.all(
      filtered.map(async (r) => {
        const openIssues = await db
          .select({
            status: issues.status,
            isOverdue: issues.isOverdue,
          })
          .from(issues)
          .where(eq(issues.assignedWorkerId, r.id));
        const active = openIssues.filter((i) =>
          ["ASSIGNED", "IN_PROGRESS", "REOPENED", "ESCALATED"].includes(i.status)
        );
        return {
          id: r.id,
          name: r.name,
          employeeId: r.employeeId,
          zone: r.zone,
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          active: r.active,
          assigned: active.length,
          inProgress: active.filter((i) => i.status === "IN_PROGRESS").length,
          overdue: active.filter((i) => i.isOverdue).length,
        };
      })
    );
  }
);

export async function getWorkerByUserId(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ worker: workers, departmentName: departments.name })
    .from(workers)
    .innerJoin(departments, eq(workers.departmentId, departments.id))
    .where(and(eq(workers.userId, userId), eq(workers.active, true)))
    .limit(1);
  return rows[0] ?? null;
}
