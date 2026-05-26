import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildActionsCatalog, createPool, runContainer } from "@talos/client";
import hre from "hardhat";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL env var required");
}

// Apply contracts/migrations/seed_schedules.sql before the runner boots so
// any new schedule rows in that file land in the shared Talos Postgres on
// container start. The file uses INSERT ... ON CONFLICT DO NOTHING, so it
// is safe to re-run on every restart and only adds previously-unseen rows.
const __dirname = dirname(fileURLToPath(import.meta.url));
const seedSqlPath = resolve(__dirname, "migrations/seed_schedules.sql");
const seedSql = readFileSync(seedSqlPath, "utf8");
const pool = createPool({ connectionString: databaseUrl });
try {
  await pool.query(seedSql);
  console.log(`[runner] applied ${seedSqlPath}`);
} finally {
  await pool.end();
}

const actionsCatalog = buildActionsCatalog(hre);

await runContainer({
  product: "origin-dollar",
  baseUrl: process.env.RUNNER_BASE_URL ?? "http://origin-dollar:8080",
  workdir: "/app",
  actionsCatalog,
});
