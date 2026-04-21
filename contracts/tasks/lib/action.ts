import { randomUUID } from "node:crypto";
import type { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import type { ConfigurableTaskDefinition } from "hardhat/types";
import type { Logger } from "winston";
import {
  createDb,
  createPool,
  type Db,
  wrapSignerWithNonceQueueV5,
} from "@automaton/client";

import { getSigner as defaultGetSigner } from "../../utils/signers";
import logger, {
  flushLogger,
  isWinstonLogModeEnabled,
  withLogContext,
} from "./logger";

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

export function createActionHandler(
  config: ActionConfig,
  deps: ActionDeps = {}
) {
  const { name, chains, run } = config;
  const getSigner = deps.getSigner ?? defaultGetSigner;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const legacyLoggerFactory = require("../../utils/logger");

  return async (taskArgs: Record<string, any>) => {
    const winstonMode = isWinstonLogModeEnabled();
    const propagatedRunId = process.env.ACTION_RUN_ID?.trim();
    const propagatedActionName = process.env.ACTION_NAME?.trim();
    const actionLabel =
      propagatedActionName && propagatedActionName.length > 0
        ? propagatedActionName
        : name;
    const runId =
      propagatedRunId && propagatedRunId.length > 0
        ? propagatedRunId
        : randomUUID();
    const log: Logger = winstonMode
      ? logger.child({ action: actionLabel, run_id: runId, source: "task" })
      : legacyLoggerFactory(`action:${name}`);
    const startTime = Date.now();
    let chainId: number | undefined;
    let networkName: string | undefined;

    const execute = async () => {
      try {
        const rawSigner = await getSigner();
        const network = await rawSigner.provider!.getNetwork();
        chainId = Number(network.chainId);
        const db = getNonceDb();
        const signer = db
          ? wrapSignerWithNonceQueueV5(rawSigner, { db, log })
          : rawSigner;
        networkName = CHAIN_NAMES[chainId] ?? `unknown-${chainId}`;

        if (winstonMode) {
          log.info(`Running on ${networkName} (${chainId})`, {
            event: "action.start",
            source: "task",
            chain_id: chainId,
            network: networkName,
          });
        } else {
          log.info(`Running on ${networkName} (${chainId})`);
        }

        if (chains && !chains.includes(chainId)) {
          const valid = chains
            .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
            .join(", ");
          throw new Error(
            `${name} only supports ${valid}, not ${networkName} (${chainId})`
          );
        }

        await run({ signer, chainId, networkName, log, args: taskArgs });
        if (winstonMode) {
          log.info(
            `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
            {
              event: "action.success",
              source: "task",
              chain_id: chainId,
              network: networkName,
              duration_ms: Date.now() - startTime,
            }
          );
        } else {
          log.info(
            `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
          );
        }
      } catch (err: any) {
        if (winstonMode) {
          log.error(`${err?.name ?? "Error"}: ${err?.message ?? String(err)}`, {
            event: "action.error",
            source: "task",
            chain_id: chainId,
            network: networkName,
            duration_ms: Date.now() - startTime,
            error_name: err?.name ?? "Error",
            error_message: err?.message ?? String(err),
            error_stack: err?.stack,
          });
        } else {
          log.error(`${err?.name ?? "Error"}: ${err?.message ?? String(err)}`);
        }
        throw err;
      } finally {
        if (winstonMode) {
          await flushLogger();
        }
      }
    };

    if (!winstonMode) {
      return execute();
    }

    return withLogContext(
      { action: actionLabel, run_id: runId, source: "task" },
      execute
    );
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
