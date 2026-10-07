import { defineConfig } from "drizzle-kit";

/**
 * CivicIssue supports two database dialects:
 *  - SQLite     (default for local development / demo mode)
 *  - PostgreSQL (production — set DATABASE_URL=postgres://...)
 *
 * The dialect is selected from DATABASE_URL so a single command works for both:
 *   npx drizzle-kit push
 */
const url = process.env.DATABASE_URL ?? "file:./data/civicissue.db";
const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

export default defineConfig(
  isPostgres
    ? {
        schema: "./drizzle/pg/schema.ts",
        out: "./drizzle/pg/migrations",
        dialect: "postgresql",
        dbCredentials: { url },
      }
    : {
        schema: "./drizzle/sqlite/schema.ts",
        out: "./drizzle/sqlite/migrations",
        dialect: "sqlite",
        dbCredentials: { url: url.replace(/^file:/, "") },
      }
);
