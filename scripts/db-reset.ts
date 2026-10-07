import { rmSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./data/civicissue.db";
if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
  throw new Error("db:reset is intentionally disabled for PostgreSQL. Reset production/staging databases with an explicit, reviewed procedure.");
}

const configuredPath = url.replace(/^(file:|sqlite:)/, "");
if (!configuredPath || configuredPath === ":memory:") {
  throw new Error("db:reset requires a file-backed local SQLite DATABASE_URL.");
}

const file = path.resolve(configuredPath);
const projectRoot = path.resolve(process.cwd());
if (!file.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error("db:reset only removes SQLite files located inside the project directory.");
}

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${file}${suffix}`, { force: true });
}
console.log(`✔ Removed local SQLite database: ${path.relative(projectRoot, file)}`);
