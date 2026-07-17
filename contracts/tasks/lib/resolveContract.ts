import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getContract,
  type Abi,
  type Address,
  type GetContractReturnType,
  type PublicClient,
  type WalletClient,
} from "viem";

// contracts/ root (this file is contracts/tasks/lib/resolveContract.ts).
const CONTRACTS_ROOT = join(__dirname, "..", "..");

// chainId -> hardhat-deploy `deployments/` sub-directory. Mirrors the
// `networkMap` in utils/hardhat-helpers.js (source of truth for the mapping).
const DIR_BY_CHAIN: Record<number, string> = {
  1: "mainnet",
  17000: "holesky",
  42161: "arbitrumOne",
  8453: "base",
  146: "sonic",
  98866: "plume",
  560048: "hoodi",
  999: "hyperevm",
};

function deploymentDir(chainId: number): string {
  const dir = DIR_BY_CHAIN[chainId];
  if (!dir) throw new Error(`No deployments directory mapped for chain ${chainId}`);
  return dir;
}

const deploymentCache = new Map<string, { address: Address; abi: Abi }>();
function readDeployment(
  chainId: number,
  name: string
): { address: Address; abi: Abi } {
  const dir = deploymentDir(chainId);
  const cacheKey = `${dir}/${name}`;
  const cached = deploymentCache.get(cacheKey);
  if (cached) return cached;

  const path = join(CONTRACTS_ROOT, "deployments", dir, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Deployment '${name}' not found for chain ${chainId} at ${path}. ` +
        `If this contract was deployed via Foundry, add its address to ` +
        `deployments/${dir}/ or pin it in the action.`
    );
  }
  const json = JSON.parse(readFileSync(path, "utf8"));
  const entry = { address: json.address as Address, abi: json.abi as Abi };
  deploymentCache.set(cacheKey, entry);
  return entry;
}

const curatedAbiCache = new Map<string, Abi>();
function readCuratedAbi(file: string): Abi {
  const fileName = file.endsWith(".json") ? file : `${file}.json`;
  const cached = curatedAbiCache.get(fileName);
  if (cached) return cached;
  const path = join(CONTRACTS_ROOT, "abi", fileName);
  if (!existsSync(path)) {
    throw new Error(`Curated ABI '${fileName}' not found at ${path}`);
  }
  const abi = JSON.parse(readFileSync(path, "utf8")) as Abi;
  curatedAbiCache.set(fileName, abi);
  return abi;
}

/**
 * Where a contract's call-surface ABI comes from:
 *  - `curated`:     contracts/abi/<file>.json (interface ABI — the default)
 *  - `inline`:      an ABI passed directly (human-readable or JSON)
 *  - `deployment`:  the .abi from deployments/<dir>/<name>.json (rarely what
 *                   you want — proxy artifacts are admin-only, concrete ones
 *                   can be stale; use only when the deployment ABI is correct)
 */
export type AbiSource =
  | { kind: "curated"; file: string }
  | { kind: "inline"; abi: Abi }
  | { kind: "deployment"; name: string };

export interface ResolveArgs {
  /** Explicit/pinned address (deployed truth from addresses.js or a constant). */
  address?: Address;
  /** Or resolve the address from deployments/<dir>/<name>.json .address. */
  deploymentName?: string;
  abiFrom: AbiSource;
}

export type ResolvedClients = {
  public: PublicClient;
  wallet?: WalletClient;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResolvedContract = GetContractReturnType<Abi, any>;

/**
 * Bind a contract resolver to a chain + clients. Returns a viem contract
 * (`.read.*` / `.write.*` / `.address` / `.abi`). Address comes from deployed
 * truth (deployments / pinned); ABI defaults to the curated interface.
 *
 * Example (address from proxy deployment, ABI from curated interface):
 *   resolveContract({ deploymentName: "VaultProxy", abiFrom: { kind: "curated", file: "IVault" } })
 */
export function makeResolveContract(
  chainId: number,
  clients: ResolvedClients
): (args: ResolveArgs) => ResolvedContract {
  return (args) => {
    const address =
      args.address ??
      readDeployment(chainId, requireDeploymentName(args)).address;

    const abi =
      args.abiFrom.kind === "deployment"
        ? readDeployment(chainId, args.abiFrom.name).abi
        : args.abiFrom.kind === "curated"
          ? readCuratedAbi(args.abiFrom.file)
          : args.abiFrom.abi;

    return getContract({
      address,
      abi,
      client: { public: clients.public, wallet: clients.wallet },
    }) as ResolvedContract;
  };
}

function requireDeploymentName(args: ResolveArgs): string {
  if (!args.deploymentName) {
    throw new Error(
      "resolveContract requires either `address` or `deploymentName`"
    );
  }
  return args.deploymentName;
}
