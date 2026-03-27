import type { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import type { ConfigurableTaskDefinition } from "hardhat/types";
import type { Logger } from "winston";

import { getSigner } from "../../utils/signers";
import logger from "./logger";

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
    const log = logger.child({ action: name });
    const startTime = Date.now();

    log.info("Starting");

    const signer = await getSigner();
    const network = await signer.provider!.getNetwork();
    const chainId = network.chainId;
    const networkName = CHAIN_NAMES[chainId] ?? `unknown-${chainId}`;

    if (chains && !chains.includes(chainId)) {
      const valid = chains
        .map((id) => `${CHAIN_NAMES[id] ?? id} (${id})`)
        .join(", ");
      throw new Error(
        `${name} only supports ${valid}, not ${networkName} (${chainId})`
      );
    }

    log.info(`Running on ${networkName} (${chainId})`);

    try {
      await run({ signer, chainId, networkName, log, args: taskArgs });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log.info(`Completed in ${elapsed}s`);
    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log.error(`Failed after ${elapsed}s: ${err.message}`);
      throw err;
    }
  });

  task(name).setAction(async (_, __, runSuper) => {
    return runSuper();
  });
}
