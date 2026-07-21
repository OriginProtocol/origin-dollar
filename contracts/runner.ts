import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type ActionsCatalog, createPool, runContainer } from "@oplabs/talos-client";

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

// The catalog is dumped at image build time by docker/dump-actions-catalog.cjs
// (Node, where hardhat works). Reading it here keeps the runner's bun parent
// out of hardhat's load path, which crashes under bun (keccak native module —
// bun#18546). Missing/invalid file ⇒ empty catalog ⇒ admin UI fail-closes
// to zero editable flags for this product.
const CATALOG_PATH = "/app/actions-catalog.json";
let actionsCatalog: ActionsCatalog = {};
if (existsSync(CATALOG_PATH)) {
  try {
    actionsCatalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
    console.log(
      `[runner] loaded actions catalog: ${Object.keys(actionsCatalog).length} tasks`,
    );
  } catch (err) {
    console.warn(
      `[runner] failed to parse ${CATALOG_PATH}: ${(err as Error).message}`,
    );
  }
}

await runContainer({
  product: "origin-dollar",
  baseUrl: process.env.RUNNER_BASE_URL ?? "http://origin-dollar:8080",
  workdir: "/app",
  actionsCatalog,
});
