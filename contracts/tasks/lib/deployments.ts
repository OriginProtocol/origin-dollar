import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getChainId } from "./network";

export type Deployment = {
  address: string;
  abi: unknown[];
  [key: string]: unknown;
};

const ROOT = join(__dirname, "..", "..", "deployments");
export const DEPLOYMENT_DIR_BY_CHAIN: Record<number, string> = {
  1: "mainnet",
  42161: "arbitrumOne",
  8453: "base",
  146: "sonic",
  98866: "plume",
  560048: "hoodi",
  999: "hyperevm",
};

function directory(chainId = getChainId()): string {
  const name = DEPLOYMENT_DIR_BY_CHAIN[chainId];
  if (!name) throw new Error(`No deployment directory for chain ${chainId}`);
  return join(ROOT, name);
}

export function get(name: string, chainId = getChainId()): Deployment {
  const deployment = getOrNull(name, chainId);
  if (!deployment) {
    throw new Error(
      `Deployment '${name}' not found in deployments/${DEPLOYMENT_DIR_BY_CHAIN[chainId]}`
    );
  }
  return deployment;
}

export function getOrNull(
  name: string,
  chainId = getChainId()
): Deployment | null {
  const path = join(directory(chainId), `${name}.json`);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Deployment)
    : null;
}

export function all(chainId = getChainId()): Record<string, Deployment> {
  return Object.fromEntries(
    readdirSync(directory(chainId))
      .filter((file) => !file.startsWith(".") && file.endsWith(".json"))
      .sort()
      .map((file) => [
        file.slice(0, -5),
        JSON.parse(readFileSync(join(directory(chainId), file), "utf8")),
      ])
      .filter(([, deployment]) => typeof deployment.address === "string")
  );
}
