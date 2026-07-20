import { ethers } from "ethers";
import { resolveChain, getRpcEnvVar } from "@talos/client";

/**
 * Ambient network context for the standalone (hardhat-free) action runtime.
 * `run.ts` calls initNetwork() once per process from `--network`; getContract /
 * getContractAt / getSigner read the provider + chainId from here — the same
 * role `hre.network` / `hre.ethers.provider` played under hardhat.
 */

export const CHAIN_NAMES: Record<number, string> = {
  1: "mainnet",
  8453: "base",
  146: "sonic",
  560048: "hoodi",
  999: "hyperevm",
  17000: "holesky",
  42161: "arbitrum",
  98866: "plume",
};

let _chainId: number | undefined;
let _networkName: string | undefined;
let _provider: ethers.providers.JsonRpcProvider | undefined;
let _signer: ethers.Signer | undefined;

/** Resolve the RPC URL for a chain: LOCAL_PROVIDER_URL on a fork, else the
 *  `*_PROVIDER_URL` env var (via Talos getRpcEnvVar, matching the repo's names). */
export function rpcUrlFor(nameOrId: string | number): {
  chainId: number;
  networkName: string;
  url: string;
} {
  const chain = resolveChain(nameOrId);
  let url: string | undefined;
  if (process.env.FORK === "true" && process.env.LOCAL_PROVIDER_URL) {
    url = process.env.LOCAL_PROVIDER_URL;
  } else {
    const envVar = getRpcEnvVar(chain);
    url = process.env[envVar];
    // Back-compat: mainnet historically used the bare PROVIDER_URL.
    if (!url && chain.id === 1) url = process.env.PROVIDER_URL;
    if (!url) {
      throw new Error(
        `Missing RPC URL env var ${envVar} for chain ${chain.name} (${chain.id})`
      );
    }
  }
  return {
    chainId: chain.id,
    networkName: CHAIN_NAMES[chain.id] ?? chain.name,
    url,
  };
}

export function initNetwork(nameOrId: string | number): {
  chainId: number;
  networkName: string;
  provider: ethers.providers.JsonRpcProvider;
} {
  const { chainId, networkName, url } = rpcUrlFor(nameOrId);
  _chainId = chainId;
  _networkName = networkName;
  // Static network avoids an extra eth_chainId probe; a fork keeps the real
  // chain id, so this stays correct against anvil --fork-url too.
  _provider = new ethers.providers.JsonRpcProvider(url, chainId);
  _signer = undefined;
  return { chainId, networkName, provider: _provider };
}

export function getProvider(): ethers.providers.JsonRpcProvider {
  if (!_provider)
    throw new Error("Network not initialized — call initNetwork() first");
  return _provider;
}

export function getChainId(): number {
  if (_chainId == null) throw new Error("Network not initialized");
  return _chainId;
}

export function getNetworkName(): string {
  if (!_networkName) throw new Error("Network not initialized");
  return _networkName;
}

export function setSigner(signer: ethers.Signer): void {
  _signer = signer;
}

/** getContract/getContractAt bind to the ambient signer when set (so writes work
 *  like hardhat's signer-connected contracts), else the provider (reads). */
export function getSignerOrProvider():
  | ethers.Signer
  | ethers.providers.Provider {
  return _signer ?? getProvider();
}
