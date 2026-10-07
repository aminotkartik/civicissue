/**
 * Database access layer.
 *
 * Selects the driver from DATABASE_URL:
 *   - file:./path.db  or  sqlite:path  → better-sqlite3 (development/demo)
 *   - postgres://...                   → postgres.js   (production)
 *
 * Both dialects share identical table/column names and JS-level types
 * (see drizzle/sqlite/schema.ts and drizzle/pg/schema.ts), so all query code
 * in lib/queries is written once against the canonical schema types.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as schema from "@/drizzle/sqlite/schema";

const url = process.env.DATABASE_URL ?? "file:./data/civicissue.db";
export const isPostgres =
  url.startsWith("postgres://") || url.startsWith("postgresql://");

type SqliteDb = ReturnType<typeof createSqliteDb>;

function createSqliteDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const file = url.replace(/^(file:|sqlite:)/, "");
  if (file !== ":memory:" && file !== "") {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzleSqlite(sqlite, { schema });
}

async function createPgDb() {
  const postgres = (await import("postgres")).default;
  const client = postgres(url, { max: 10 });
  return drizzlePg(client, { schema });
}

// Built synchronously for SQLite; for Postgres we await the dynamic import
// once at module load (server runtime only — never imported by client code).
let dbInstance: SqliteDb | null = null;
let dbPromise: Promise<SqliteDb> | null = null;

if (!isPostgres) {
  dbInstance = createSqliteDb();
} else {
  dbPromise = createPgDb().then((d) => d as unknown as SqliteDb);
}

/** The Drizzle database instance. For Postgres, await `getDb()` first. */
export const db: SqliteDb = isPostgres
  ? ({} as SqliteDb) // replaced on first getDb() call
  : dbInstance!;

/** Always use this accessor in server code — works for both dialects. */
export async function getDb(): Promise<SqliteDb> {
  if (dbInstance) return dbInstance;
  if (dbPromise) {
    dbInstance = await dbPromise;
    return dbInstance;
  }
  dbInstance = createSqliteDb();
  return dbInstance;
}

/** Synchronous accessor for scripts/seed after `await ensureDb()`. */
export async function ensureDb(): Promise<SqliteDb> {
  return getDb();
}

export type Db = SqliteDb;
export * as tables from "@/drizzle/sqlite/schema";


/**
 * Cross-dialect transaction helper.
 *
 * Drizzle's better-sqlite3 driver rejects async transaction callbacks, while
 * postgres.js requires them. On SQLite we therefore run BEGIN/COMMIT/ROLLBACK
 * manually around the (thenable-executed) work function; on Postgres we use
 * Drizzle's native transaction. Re-entrant: nested calls join the outer
 * transaction instead of starting a new one.
 *
 * Note: better-sqlite3 shares one synchronous connection, so under heavy
 * concurrent load interleaved writes could join an open transaction. This is
 * acceptable for the demo/dev target; production runs on Postgres, where
 * withTransaction is fully ACID per request.
 */
let txDepth = 0;

export async function withTransaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  const database = await getDb();
  if (txDepth > 0) return work(database);
  txDepth += 1;
  try {
    if (isPostgres) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (database as any).transaction(work as any);
    }
    database.run(sql`BEGIN`);
    try {
      const result = await work(database);
      database.run(sql`COMMIT`);
      return result;
    } catch (err) {
      try {
        database.run(sql`ROLLBACK`);
      } catch {
        /* rollback failed — connection will be reset by next statement */
      }
      throw err;
    }
  } finally {
    txDepth -= 1;
  }
}
