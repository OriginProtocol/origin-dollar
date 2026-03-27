import {
  type Chain,
  createPublicClient,
  createWalletClient,
  http,
  type LocalAccount,
} from "viem";
import { base, holesky, hoodi, hyperEvm, mainnet, sonic } from "viem/chains";
import { requireEnv } from "./env";

const CHAIN_CONFIG: Record<number, { chain: Chain; envVar: string }> = {
  [mainnet.id]: { chain: mainnet, envVar: "PROVIDER_URL" },
  [base.id]: { chain: base, envVar: "BASE_PROVIDER_URL" },
  [sonic.id]: { chain: sonic, envVar: "SONIC_PROVIDER_URL" },
  [hoodi.id]: { chain: hoodi, envVar: "HOODI_PROVIDER_URL" },
  [holesky.id]: { chain: holesky, envVar: "HOLESKY_PROVIDER_URL" },
  [hyperEvm.id]: { chain: hyperEvm, envVar: "HYPEREVM_PROVIDER_URL" },
};

const CHAIN_BY_NAME: Record<string, Chain> = Object.fromEntries(
  Object.values(CHAIN_CONFIG).map((c) => [c.chain.name.toLowerCase(), c.chain])
);
const CHAIN_BY_ID: Record<number, Chain> = Object.fromEntries(
  Object.values(CHAIN_CONFIG).map((c) => [c.chain.id, c.chain])
);

/**
 * Resolve a chain from a name (e.g. "mainnet") or chain ID (e.g. "1" or 1).
 */
export function resolveChain(nameOrId: string | number): Chain {
  if (typeof nameOrId === "number") {
    const chain = CHAIN_BY_ID[nameOrId];
    if (!chain) throw new Error(`Unknown chain id ${nameOrId}`);
    return chain;
  }
  // Try as number first, then as name
  const asNum = Number(nameOrId);
  if (!Number.isNaN(asNum)) {
    const chain = CHAIN_BY_ID[asNum];
    if (chain) return chain;
  }
  const chain = CHAIN_BY_NAME[nameOrId.toLowerCase()];
  if (!chain) {
    const supported = Object.values(CHAIN_CONFIG)
      .map((c) => `${c.chain.name.toLowerCase()} (${c.chain.id})`)
      .join(", ");
    throw new Error(`Unknown chain "${nameOrId}". Supported: ${supported}`);
  }
  return chain;
}

function getConfig(chain: Chain) {
  const config = CHAIN_CONFIG[chain.id];
  if (!config) {
    throw new Error(`No config for chain id ${chain.id}`);
  }
  return config;
}

export function getRpcUrl(chain: Chain): string {
  return requireEnv(getConfig(chain).envVar);
}

export function getPublicClient(chain: Chain) {
  return createPublicClient({
    chain,
    transport: http(getRpcUrl(chain)),
  });
}

export function getWalletClient(chain: Chain, account: LocalAccount) {
  return createWalletClient({
    chain,
    account,
    transport: http(getRpcUrl(chain)),
  });
}
