#!/usr/bin/env tsx
/**
 * Dump the action registry as the Talos admin catalog JSON. Replaces the
 * hardhat-based dump-actions-catalog.cjs. Run at image-build time under tsx:
 *   tsx dump-actions-catalog.ts > /app/actions-catalog.json
 */
import "dotenv/config";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { ActionParam, ActionsCatalog } from "@talos/client";
import { registry } from "./tasks/lib/action";

// Per-task parameter allow-lists — only these params are editable from the
// Talos admin UI. Copied verbatim from the old dump-actions-catalog.cjs.
const TALOS_PARAM_ALLOWLISTS: Record<string, Set<string>> = {
  removeValidator: new Set(["consol", "operatorids", "pubkey"]),
  stakeValidator: new Set([
    "amount",
    "consol",
    "depositMessageRoot",
    "pubkey",
    "sig",
  ]),
};

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

async function loadActions(): Promise<void> {
  const actionsDir = join(__dirname, "tasks", "actions");
  for (const file of readdirSync(actionsDir).sort()) {
    if (!file.endsWith(".ts") || file.startsWith("_")) continue;
    try {
      await import(join(actionsDir, file));
    } catch (err) {
      console.error(
        `[dump-catalog] skipped ${file}: ${
          (err as Error).message?.split("\n")[0] ?? err
        }`
      );
    }
  }
}

async function main(): Promise<void> {
  await loadActions();
  const catalog: ActionsCatalog = {};
  for (const [name, entry] of registry) {
    const allow = TALOS_PARAM_ALLOWLISTS[name];
    catalog[name] = entry.params
      .filter((p) => !allow || allow.has(p.name))
      .map<ActionParam>((p) => ({
        paramName: p.name,
        cliFlag: `--${camelToKebab(p.name)}`,
        description: p.description,
        type: p.type,
        isOptional: p.isOptional,
        isFlag: p.isFlag,
        hasDefault: p.hasDefault,
        defaultValue: p.defaultValue as ActionParam["defaultValue"],
      }));
  }
  process.stdout.write(JSON.stringify(catalog));
}

void main();
