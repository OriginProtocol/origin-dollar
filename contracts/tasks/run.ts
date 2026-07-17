#!/usr/bin/env tsx
/**
 * Standalone viem CLI entrypoint for Talos actions (replaces `pnpm hardhat
 * <task> --network <net>`). The Talos dispatcher spawns this as a tsx/node
 * child, e.g. `pnpm exec tsx tasks/run.ts harvest --network mainnet`.
 *
 * Usage: tsx tasks/run.ts <actionName> --network <net> [--flag value ...]
 */
import { resolveChain } from "@talos/client";
import { makePublicClient } from "./lib/clients";
import { resolveSigner } from "./lib/accounts";
import { makeSendTx, makeWriteContract } from "./lib/sendTx";
import { makeResolveContract } from "./lib/resolveContract";
import { registry, type Logger, type ParamSpec } from "./lib/viemAction";
// Side-effect: register all migrated viem actions.
import "./actions-viem";

const CHAIN_NAMES: Record<number, string> = {
  1: "mainnet",
  8453: "base",
  146: "sonic",
  560048: "hoodi",
  999: "hyperevm",
  17000: "holesky",
  42161: "arbitrum",
  98866: "plume",
};

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

interface ParsedCli {
  name?: string;
  network?: string;
  flags: Record<string, string | boolean>;
}

function parseCli(argv: string[]): ParsedCli {
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
  const network =
    typeof flags.network === "string" ? flags.network : undefined;
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
      if (spec.default !== undefined) out[spec.name] = spec.default;
      else if (spec.flag) out[spec.name] = false;
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

function fail(msg: string, code = 2): never {
  console.error(msg);
  process.exit(code);
}

async function main(): Promise<void> {
  const { name, network, flags } = parseCli(process.argv.slice(2));

  if (!name) {
    fail(
      "usage: tsx tasks/run.ts <action> --network <net> [--flag value ...]\n" +
        `known actions: ${[...registry.keys()].sort().join(", ")}`
    );
  }
  const config = registry.get(name);
  if (!config) {
    fail(
      `Unknown action '${name}'. Known: ${[...registry.keys()].sort().join(", ")}`
    );
  }
  if (!network) fail("--network is required");

  const chain = resolveChain(network);
  const log = makeLog(name);

  if (config.chains && config.chains.length && !config.chains.includes(chain.id)) {
    const valid = config.chains
      .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
      .join(", ");
    fail(
      `${name} only supports ${valid}, not ${chain.name} (${chain.id})`,
      1
    );
  }

  const args = coerceParams(config.params ?? [], flags);
  const networkName = CHAIN_NAMES[chain.id] ?? chain.name;
  const start = Date.now();
  log.info(`Running on ${networkName} (${chain.id})`);

  const { publicClient } = makePublicClient(chain.id);
  const { account, walletClient } = await resolveSigner(chain);
  const sendTx = makeSendTx(walletClient, publicClient, log);
  const writeContract = makeWriteContract(sendTx);
  const resolveContract = makeResolveContract(chain.id, {
    public: publicClient,
    wallet: walletClient,
  });

  try {
    await config.run({
      publicClient,
      walletClient,
      account,
      chainId: chain.id,
      networkName,
      log,
      args,
      sendTx,
      writeContract,
      resolveContract,
    });
    log.info(`Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    const e = err as { name?: string; message?: string; stack?: string };
    log.error(`${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
    if (e?.stack) log.error(e.stack);
    process.exit(1);
  }
}

void main();
