import { ethers } from "ethers";

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

const CHAIN_IDS: Record<string, number> = {
  ...Object.fromEntries(
    Object.entries(CHAIN_NAMES).map(([id, name]) => [name, Number(id)])
  ),
  // Hardhat's name for 42161, still used by Talos schedules, deployments/ and
  // addresses.js.
  arbitrumone: 42161,
};

const RPC_ENV_VARS: Record<number, string> = {
  1: "MAINNET_PROVIDER_URL",
  8453: "BASE_PROVIDER_URL",
  146: "SONIC_PROVIDER_URL",
  560048: "HOODI_PROVIDER_URL",
  999: "HYPEREVM_PROVIDER_URL",
  17000: "HOLESKY_PROVIDER_URL",
  42161: "ARBITRUM_PROVIDER_URL",
  98866: "PLUME_PROVIDER_URL",
};

let _chainId: number | undefined;
let _networkName: string | undefined;
let _provider: ethers.providers.JsonRpcProvider | undefined;
let _signer: ethers.Signer | undefined;

type HardhatGlobal = {
  hre?: {
    ethers?: { provider?: ethers.providers.JsonRpcProvider };
    network?: { name?: string; config?: { chainId?: number } };
  };
};

function hardhatRuntime() {
  return (globalThis as typeof globalThis & HardhatGlobal).hre;
}

/** Resolve the RPC URL for a chain: LOCAL_PROVIDER_URL on a fork, else the
 *  matching `*_PROVIDER_URL` env var. */
export function rpcUrlFor(nameOrId: string | number): {
  chainId: number;
  networkName: string;
  url: string;
} {
  const chainId =
    typeof nameOrId === "number"
      ? nameOrId
      : /^\d+$/.test(nameOrId)
      ? Number(nameOrId)
      : CHAIN_IDS[nameOrId.toLowerCase()];
  const networkName = CHAIN_NAMES[chainId];
  if (!networkName) {
    throw new Error(`Unsupported chain: ${nameOrId}`);
  }
  let url: string | undefined;
  // On a fork, prefer a per-chain URL so a multi-chain fork stack works — one
  // anvil per chain, since anvil serves a single chain id. Falling back to the
  // shared LOCAL_PROVIDER_URL keeps single-chain forks working unchanged.
  // Without the per-chain form, every chain resolves to the same fork and a
  // non-mainnet action fails in initNetwork(): the provider is constructed for
  // its real chain id while the node reports the fork's, and ethers throws
  // "underlying network changed".
  const forkUrl =
    process.env.FORK === "true"
      ? process.env[`LOCAL_PROVIDER_URL_${chainId}`] ||
        process.env.LOCAL_PROVIDER_URL
      : undefined;
  if (forkUrl) {
    url = forkUrl;
  } else {
    const envVar = RPC_ENV_VARS[chainId];
    url = process.env[envVar];
    // Back-compat: mainnet historically used the bare PROVIDER_URL.
    if (!url && chainId === 1) url = process.env.PROVIDER_URL;
    if (!url) {
      throw new Error(
        `Missing RPC URL env var ${envVar} for chain ${networkName} (${chainId})`
      );
    }
  }
  return {
    chainId,
    networkName,
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
  const provider = _provider ?? hardhatRuntime()?.ethers?.provider;
  if (!provider)
    throw new Error("Network not initialized — call initNetwork() first");
  return provider;
}

export function getChainId(): number {
  const hardhatNetwork = hardhatRuntime()?.network;
  const chainId =
    _chainId ??
    hardhatNetwork?.config?.chainId ??
    (hardhatNetwork?.name
      ? CHAIN_IDS[hardhatNetwork.name.toLowerCase()]
      : undefined);
  if (chainId == null) throw new Error("Network not initialized");
  return chainId;
}

export function getNetworkName(): string {
  const networkName = _networkName ?? hardhatRuntime()?.network?.name;
  if (!networkName) throw new Error("Network not initialized");
  return networkName;
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
