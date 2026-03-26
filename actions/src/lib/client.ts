import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type LocalAccount,
} from "viem";
import {
  mainnet,
  base,
  sonic,
  hoodi,
  holesky,
  hyperEvm,
} from "viem/chains";
import { requireEnv } from "./env";

const CHAIN_CONFIG = {
  mainnet: { chain: mainnet, envVar: "PROVIDER_URL" },
  base: { chain: base, envVar: "BASE_PROVIDER_URL" },
  sonic: { chain: sonic, envVar: "SONIC_PROVIDER_URL" },
  hoodi: { chain: hoodi, envVar: "HOODI_PROVIDER_URL" },
  holesky: { chain: holesky, envVar: "HOLESKY_PROVIDER_URL" },
  hyperevm: { chain: hyperEvm, envVar: "HYPEREVM_PROVIDER_URL" },
} as const;

export function getChain(network: keyof typeof CHAIN_CONFIG): Chain {
  const config = CHAIN_CONFIG[network];
  if (!config) {
    throw new Error(
      `Unknown network "${network}". Supported: ${Object.keys(CHAIN_CONFIG).join(", ")}`
    );
  }
  return config.chain;
}

export function getRpcUrl(network: keyof typeof CHAIN_CONFIG): string {
  const config = CHAIN_CONFIG[network];
  if (!config) {
    throw new Error(
      `Unknown network "${network}". Supported: ${Object.keys(CHAIN_CONFIG).join(", ")}`
    );
  }
  return requireEnv(config.envVar);
}

export function getPublicClient(chain: Chain) {
  const config = Object.values(CHAIN_CONFIG).find(
    (c) => c.chain.id === chain.id
  );
  if (!config) {
    throw new Error(`No RPC config for chain id ${chain.id}`);
  }
  const url = requireEnv(config.envVar);
  return createPublicClient({
    chain,
    transport: http(url),
  });
}

export function getWalletClient(chain: Chain, account: LocalAccount) {
  const config = Object.values(CHAIN_CONFIG).find(
    (c) => c.chain.id === chain.id
  );
  if (!config) {
    throw new Error(`No RPC config for chain id ${chain.id}`);
  }
  const url = requireEnv(config.envVar);
  return createWalletClient({
    chain,
    account,
    transport: http(url),
  });
}
