import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { counters } from "@/drizzle/sqlite/schema";
import { withTransaction } from "@/lib/db";

export function uuid(): string {
  return randomUUID();
}

/**
 * Generates the next human-readable complaint ID, e.g. `CIV-2026-000123`.
 * Uses an atomic counter row per year (safe under concurrent writes).
 */
export async function nextPublicId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `issue_seq_${year}`;
  return withTransaction(async (tx) => {
    // Upsert the counter row, then atomically increment + read.
    await tx
      .insert(counters)
      .values({ key, value: 0 })
      .onConflictDoNothing({ target: counters.key });
    const rows = await tx
      .update(counters)
      .set({ value: sql`${counters.value} + 1` })
      .where(eq(counters.key, key))
      .returning({ value: counters.value });
    const value = rows[0]?.value ?? 1;
    return `CIV-${year}-${String(value).padStart(6, "0")}`;
  });
}

export function isPublicId(value: string): boolean {
  return /^CIV-\d{4}-\d{6}$/.test(value);
}
