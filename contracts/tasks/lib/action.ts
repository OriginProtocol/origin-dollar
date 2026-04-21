import type { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import type { ConfigurableTaskDefinition } from "hardhat/types";
import {
  createDb,
  createPool,
  type Db,
  wrapSignerWithNonceQueueV5,
} from "@automaton/client";

import { getSigner as defaultGetSigner } from "../../utils/signers";

export interface Logger {
  info(msg: unknown, ...rest: unknown[]): void;
  warn(msg: unknown, ...rest: unknown[]): void;
  error(msg: unknown, ...rest: unknown[]): void;
}

let dbInstance: Db | null = null;
function getNonceDb(): Db | null {
  if (!process.env.DATABASE_URL) return null;
  if (!dbInstance) {
    const pool = createPool({ connectionString: process.env.DATABASE_URL });
    dbInstance = createDb(pool);
  }
  return dbInstance;
}

export interface ActionContext {
  signer: ethers.Signer;
  chainId: number;
  networkName: string;
  log: Logger;
  args: Record<string, any>;
}

export interface ActionConfig {
  name: string;
  description: string;
  chains?: number[];
  params?: (t: ConfigurableTaskDefinition) => void;
  run: (ctx: ActionContext) => Promise<void>;
}

export interface ActionDeps {
  getSigner?: () => Promise<ethers.Signer>;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "mainnet",
  8453: "base",
  146: "sonic",
  560048: "hoodi",
  999: "hyperevm",
  17000: "holesky",
  42161: "arbitrum",
};

function makeLog(name: string): Logger {
  const prefix = `[${name}]`;
  return {
    info: (msg, ...rest) => console.log(prefix, msg, ...rest),
    warn: (msg, ...rest) => console.warn(prefix, msg, ...rest),
    error: (msg, ...rest) => console.error(prefix, msg, ...rest),
  };
}

export function createActionHandler(
  config: ActionConfig,
  deps: ActionDeps = {}
) {
  const { name, chains, run } = config;
  const getSigner = deps.getSigner ?? defaultGetSigner;

  return async (taskArgs: Record<string, any>) => {
    const log = makeLog(name);
    const startTime = Date.now();
    let chainId: number | undefined;
    let networkName: string | undefined;

    try {
      const rawSigner = await getSigner();
      const network = await rawSigner.provider!.getNetwork();
      chainId = Number(network.chainId);
      const db = getNonceDb();
      const signer = db
        ? wrapSignerWithNonceQueueV5(rawSigner, { db, log })
        : rawSigner;
      networkName = CHAIN_NAMES[chainId] ?? `unknown-${chainId}`;

      log.info(`Running on ${networkName} (${chainId})`);

      if (chains && !chains.includes(chainId)) {
        const valid = chains
          .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
          .join(", ");
        throw new Error(
          `${name} only supports ${valid}, not ${networkName} (${chainId})`
        );
      }

      await run({ signer, chainId, networkName, log, args: taskArgs });
      log.info(
        `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
      );
    } catch (err: any) {
      log.error(`${err?.name ?? "Error"}: ${err?.message ?? String(err)}`);
      if (err?.stack) log.error(err.stack);
      throw err;
    }
  };
}

export function action(config: ActionConfig) {
  const handler = createActionHandler(config);

  const definition = subtask(config.name, config.description);
  if (config.params) {
    config.params(definition);
  }
  definition.setAction(handler);

  task(config.name).setAction(async (_, __, runSuper) => {
    return runSuper();
  });
}
