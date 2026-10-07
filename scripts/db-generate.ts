import { execSync } from "node:child_process";

console.log("▶ Generating Drizzle migrations…");
execSync("npx drizzle-kit generate", { stdio: "inherit" });
