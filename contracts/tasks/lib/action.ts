import type { ethers } from "ethers";
import { task } from "hardhat/config";
import type { ConfigurableTaskDefinition } from "hardhat/types";

import { getSigner as defaultGetSigner } from "../../utils/signers";

export interface Logger {
  info(msg: unknown, ...rest: unknown[]): void;
  warn(msg: unknown, ...rest: unknown[]): void;
  error(msg: unknown, ...rest: unknown[]): void;
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
      // Signer already wraps sendTransaction with the nonce queue when
      // DATABASE_URL is set — see utils/signers.js. Helper modules that
      // call getSigner() directly get the same wrapped signer.
      const signer = await getSigner();
      const network = await signer.provider!.getNetwork();
      chainId = Number(network.chainId);
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
      log.info(`Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } catch (err: any) {
      log.error(`${err?.name ?? "Error"}: ${err?.message ?? String(err)}`);
      if (err?.stack) log.error(err.stack);
      throw err;
    }
  };
}

export function action(config: ActionConfig) {
  const handler = createActionHandler(config);

  const definition = task(config.name, config.description);
  const skipDuplicateParams = (
    method: "addParam" | "addOptionalParam" | "addFlag"
  ) => {
    const original = definition[method].bind(definition);
    (definition as any)[method] = (name: string, ...args: unknown[]) => {
      if (definition.paramDefinitions?.[name] !== undefined) {
        return definition;
      }
      return original(name, ...args);
    };
  };

  skipDuplicateParams("addParam");
  skipDuplicateParams("addOptionalParam");
  skipDuplicateParams("addFlag");

  if (config.params) {
    config.params(definition);
  }
  definition.setAction(handler);
}
