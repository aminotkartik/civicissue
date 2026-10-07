/**
 * Applies the schema to the database selected by DATABASE_URL.
 * Wraps `drizzle-kit push` so the data directory exists for SQLite.
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "file:./data/civicissue.db";

if (url.startsWith("file:")) {
  const file = path.resolve(process.cwd(), url.replace(/^file:/, ""));
  mkdirSync(path.dirname(file), { recursive: true });
  if (!existsSync(file)) {
    // Touch the DB file so better-sqlite3/drizzle-kit start clean.
    writeFileSync(file, "");
  }
}

console.log(`▶ Pushing schema (${url.startsWith("postgres") ? "postgresql" : "sqlite"})…`);
execSync("npx drizzle-kit push --force", { stdio: "inherit" });
console.log("✔ Schema applied.");
