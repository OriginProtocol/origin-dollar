import type { ActionParam, ActionsCatalog } from "@talos/client";
import { registry } from "./viemAction";

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

/**
 * Emit the Talos admin catalog (`ActionsCatalog`) from the in-process action
 * registry — no hardhat `hre.tasks`. Shape matches `ActionParam[]` per action.
 */
export function dumpCatalog(): ActionsCatalog {
  const catalog: ActionsCatalog = {};
  for (const [name, config] of registry) {
    const allow = TALOS_PARAM_ALLOWLISTS[name];
    const params: ActionParam[] = (config.params ?? [])
      .filter((p) => !allow || allow.has(p.name))
      .map((p) => ({
        paramName: p.name,
        cliFlag: `--${camelToKebab(p.name)}`,
        description: p.description ?? "",
        type: p.type,
        isOptional: p.optional ?? true,
        isFlag: p.flag ?? false,
        hasDefault: p.default !== undefined,
        defaultValue: (p.default ?? null) as ActionParam["defaultValue"],
      }));
    catalog[name] = params;
  }
  return catalog;
}
