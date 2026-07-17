import { resolveChain, getRpcEnvVar } from "@talos/client";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type WalletClient,
} from "viem";

/**
 * viem client factory for Talos actions. Replaces `hre.ethers.provider` and
 * hardhat network config. RPC URLs come from the `*_PROVIDER_URL` env vars via
 * Talos `getRpcEnvVar` (MAINNET_PROVIDER_URL, BASE_PROVIDER_URL, ...).
 */

export function rpcUrlForChain(chain: Chain): string {
  const envVar = getRpcEnvVar(chain);
  const url = process.env[envVar];
  if (!url) {
    throw new Error(
      `Missing RPC URL env var ${envVar} for chain ${chain.name} (${chain.id})`
    );
  }
  return url;
}

/**
 * On a fork (FORK=true + LOCAL_PROVIDER_URL), transactions must hit the local
 * anvil node while the viem `chain` object stays the real chain — so tx type,
 * fee fields and chainId are all correct. Off-fork this is just the RPC URL.
 */
export function transportUrlForChain(chain: Chain): string {
  if (process.env.FORK === "true" && process.env.LOCAL_PROVIDER_URL) {
    return process.env.LOCAL_PROVIDER_URL;
  }
  return rpcUrlForChain(chain);
}

export function makePublicClient(nameOrId: string | number) {
  const chain = resolveChain(nameOrId);
  const publicClient = createPublicClient({
    chain,
    transport: http(transportUrlForChain(chain)),
  });
  return { chain, publicClient };
}

export function makeWalletClient(
  chain: Chain,
  account: Account | Address
): WalletClient {
  return createWalletClient({
    account,
    chain,
    transport: http(transportUrlForChain(chain)),
  });
}
