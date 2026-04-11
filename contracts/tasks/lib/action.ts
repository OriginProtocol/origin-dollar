import type { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import type { ConfigurableTaskDefinition } from "hardhat/types";
import type { Logger } from "winston";

import { getSigner } from "../../utils/signers";
import logger, { flushLogger } from "./logger";
import { wrapWithNonceQueue } from "./nonceQueue";

export interface ActionContext {
  signer: ethers.Signer;
  chainId: number;
  networkName: string;
  log: Logger;
  args: Record<string, any>;
}

interface ActionConfig {
  name: string;
  description: string;
  chains?: number[];
  params?: (t: ConfigurableTaskDefinition) => void;
  run: (ctx: ActionContext) => Promise<void>;
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

export function action(config: ActionConfig) {
  const { name, description, chains, params, run } = config;

  const definition = subtask(name, description);

  if (params) {
    params(definition);
  }

  definition.setAction(async (taskArgs: Record<string, any>) => {
    const runId = process.env.AUTOMATON_RUN_ID;
    const log = logger.child({
      action: name,
      ...(runId ? { run_id: runId } : {}),
    });
    const startTime = Date.now();
    let chainId: number | undefined;
    let networkName: string | undefined;

    try {
      const rawSigner = await getSigner();
      const network = await rawSigner.provider!.getNetwork();
      chainId = Number(network.chainId);
      const signer = wrapWithNonceQueue(rawSigner, chainId);
      networkName = CHAIN_NAMES[chainId] ?? `unknown-${chainId}`;

      if (chains && !chains.includes(chainId)) {
        const valid = chains
          .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
          .join(", ");
        throw new Error(
          `${name} only supports ${valid}, not ${networkName} (${chainId})`
        );
      }

      log.info(`Running on ${networkName} (${chainId})`);
      await run({ signer, chainId, networkName, log, args: taskArgs });
    } catch (err: any) {
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
      throw err;
    } finally {
      await flushLogger();
    }
  });

  task(name).setAction(async (_, __, runSuper) => {
    return runSuper();
  });
}
