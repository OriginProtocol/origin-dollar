import { existsSync, readFileSync } from "node:fs";

import { type ActionsCatalog, runContainer } from "@oplabs/talos-client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL env var required");
}

// Seeds are applied by runContainer (@oplabs/talos-client applySeedFiles),
// which reads every <workdir>/migrations/seed_*.sql before starting the
// scheduler. Applying them here too was redundant, and bypassed the
// client-side validation of seed contents.

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
      `[runner] loaded actions catalog: ${
        Object.keys(actionsCatalog).length
      } tasks`
    );
  } catch (err) {
    console.warn(
      `[runner] failed to parse ${CATALOG_PATH}: ${(err as Error).message}`
    );
  }
}

await runContainer({
  product: "origin-dollar",
  baseUrl: process.env.RUNNER_BASE_URL ?? "http://origin-dollar:8080",
  workdir: "/app",
  actionsCatalog,
});
