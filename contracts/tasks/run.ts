#!/usr/bin/env tsx
/**
 * Standalone (hardhat-free) CLI entrypoint for Talos actions. Replaces
 * `pnpm hardhat <task> --network <net>`. The Talos dispatcher spawns this as a
 * tsx/node child, e.g. `pnpm exec tsx tasks/run.ts harvest --network mainnet`.
 *
 * Usage: tsx tasks/run.ts <actionName> --network <net> [--flag value ...]
 */
import "dotenv/config";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CHAIN_NAMES, initNetwork, setSigner } from "./lib/network";
import { getSigner } from "./lib/signer";
import { registry, type Logger, type ParamSpec } from "./lib/action";

function makeLog(name: string): Logger {
  const prefix = `[${name}]`;
  return {
    info: (msg, ...rest) => console.log(prefix, msg, ...rest),
    warn: (msg, ...rest) => console.warn(prefix, msg, ...rest),
    error: (msg, ...rest) => console.error(prefix, msg, ...rest),
  };
}

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseCli(argv: string[]): {
  name?: string;
  network?: string;
  flags: Record<string, string | boolean>;
} {
  const [name, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = kebabToCamel(token.slice(2));
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  const network = typeof flags.network === "string" ? flags.network : undefined;
  delete flags.network;
  return { name, network, flags };
}

function coerceParams(
  specs: ParamSpec[],
  flags: Record<string, string | boolean>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...flags };
  for (const spec of specs) {
    const raw = flags[spec.name];
    if (raw === undefined) {
      if (spec.hasDefault) out[spec.name] = spec.defaultValue;
      else if (spec.isFlag) out[spec.name] = false;
      continue;
    }
    if (spec.type === "int") out[spec.name] = parseInt(String(raw), 10);
    else if (spec.type === "float") out[spec.name] = parseFloat(String(raw));
    else if (spec.type === "boolean")
      out[spec.name] = raw === true || raw === "true";
    else out[spec.name] = String(raw);
  }
  return out;
}

// Load every action file (side-effect: each self-registers into the registry).
// Resilient during the transition: an action not yet ported off hardhat may
// fail to import — skip it with a warning rather than sinking the whole CLI.
async function loadActions(): Promise<void> {
  const actionsDir = join(__dirname, "actions");
  for (const file of readdirSync(actionsDir).sort()) {
    if (!file.endsWith(".ts") || file.startsWith("_")) continue;
    try {
      await import(join(actionsDir, file));
    } catch (err) {
      console.warn(
        `[run] skipped ${file}: ${
          (err as Error).message?.split("\n")[0] ?? err
        }`
      );
    }
  }
}

function fail(msg: string, code = 2): never {
  console.error(msg);
  process.exit(code);
}

async function main(): Promise<void> {
  await loadActions();

  const { name, network, flags } = parseCli(process.argv.slice(2));
  if (!name) {
    fail(
      "usage: tsx tasks/run.ts <action> --network <net> [--flag value ...]\n" +
        `known actions: ${[...registry.keys()].sort().join(", ")}`
    );
  }
  const entry = registry.get(name);
  if (!entry) {
    fail(
      `Unknown action '${name}'. Known: ${[...registry.keys()]
        .sort()
        .join(", ")}`
    );
  }
  if (!network) fail("--network is required");

  const { chainId, networkName } = initNetwork(network);
  const log = makeLog(name);

  const { chains } = entry.config;
  if (chains && chains.length && !chains.includes(chainId)) {
    const valid = chains
      .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
      .join(", ");
    fail(`${name} only supports ${valid}, not ${networkName} (${chainId})`, 1);
  }

  const signer = await getSigner();
  setSigner(signer);
  const args = coerceParams(entry.params, flags);
  const start = Date.now();
  log.info(`Running on ${networkName} (${chainId})`);

  try {
    await entry.config.run({ signer, chainId, networkName, log, args });
    log.info(`Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    const e = err as { name?: string; message?: string; stack?: string };
    log.error(`${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
    if (e?.stack) log.error(e.stack);
    process.exit(1);
  }
}

void main();
