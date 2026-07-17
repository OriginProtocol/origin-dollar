#!/usr/bin/env tsx
/**
 * Dump the viem action registry as the Talos admin catalog JSON. Replaces the
 * hardhat-based dump-actions-catalog.cjs. Run at image-build time under tsx:
 *   tsx dump-actions-catalog.ts > /app/actions-catalog.json
 *
 * Self-contained: imports the registry (via the action side-effect index) and
 * the emitter, prints JSON to stdout. No hardhat, no @talos/client runtime.
 */
import { dumpCatalog } from "./tasks/lib/dumpCatalog";
// Side-effect: register all migrated viem actions.
import "./tasks/actions-viem";

process.stdout.write(JSON.stringify(dumpCatalog()));
