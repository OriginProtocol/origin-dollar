import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ethers } from "ethers";
import { getChainId, getSignerOrProvider } from "./network";

/**
 * Drop-in replacements for `hre.ethers.getContract` / `hre.ethers.getContractAt`
 * that do NOT require hardhat. Addresses come from the committed hardhat-deploy
 * artifacts in deployments/<network>/<Name>.json (the deployed truth); ABIs come
 * from the deployment artifact (getContract) or a curated interface ABI in abi/
 * (getContractAt by name). Contracts are bound to the ambient signer (writes) or
 * provider (reads), matching hardhat's signer-connected contracts.
 */

const CONTRACTS_ROOT = join(__dirname, "..", "..");

// chainId -> deployments/ sub-directory (mirrors utils/hardhat-helpers.js networkMap).
const DIR_BY_CHAIN: Record<number, string> = {
  1: "mainnet",
  42161: "arbitrumOne",
  8453: "base",
  146: "sonic",
  98866: "plume",
  560048: "hoodi",
  999: "hyperevm",
};

function deploymentDir(chainId: number): string {
  const dir = DIR_BY_CHAIN[chainId];
  if (!dir)
    throw new Error(`No deployments directory mapped for chain ${chainId}`);
  return dir;
}

function readDeployment(
  chainId: number,
  name: string
): { address: string; abi: unknown[] } {
  const path = join(
    CONTRACTS_ROOT,
    "deployments",
    deploymentDir(chainId),
    `${name}.json`
  );
  if (!existsSync(path)) {
    throw new Error(
      `Deployment '${name}' not found for chain ${chainId} at ${path}. ` +
        `If this contract was deployed via Foundry, add its artifact to ` +
        `deployments/${deploymentDir(
          chainId
        )}/ or pass an explicit ABI/address.`
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

// Resolve an ABI by contract/interface name: curated abi/<name>.json first
// (interfaces like IVault), then the deployment artifact's abi.
function readAbiByName(chainId: number, name: string): unknown[] {
  // IERC20Metadata is a strict superset of IERC20 and is the curated ERC-20
  // interface shipped with the standalone actions image.
  const curatedName = name === "IERC20" ? "IERC20Metadata" : name;
  const curated = join(CONTRACTS_ROOT, "abi", `${curatedName}.json`);
  if (existsSync(curated)) return JSON.parse(readFileSync(curated, "utf8"));
  const dep = join(
    CONTRACTS_ROOT,
    "deployments",
    deploymentDir(chainId),
    `${name}.json`
  );
  if (existsSync(dep)) return JSON.parse(readFileSync(dep, "utf8")).abi;
  const artifactPath = findFoundryArtifact(join(CONTRACTS_ROOT, "out"), name);
  if (artifactPath) {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    if (Array.isArray(artifact.abi)) return artifact.abi;
  }
  throw new Error(
    `ABI for '${name}' not found (checked abi/${name}.json and ` +
      `deployments/${deploymentDir(chainId)}/${name}.json and Foundry out/). ` +
      `Run 'forge build contracts/' or add a curated abi/${name}.json.`
  );
}

/** Drop-in for `hre.ethers.getContract(name)`: address + abi from deployments/. */
export async function getContract(name: string): Promise<ethers.Contract> {
  const { address, abi } = readDeployment(getChainId(), name);
  return new ethers.Contract(
    address,
    abi as ethers.ContractInterface,
    getSignerOrProvider()
  );
}

/** Drop-in for `hre.ethers.getContractAt(nameOrAbi, address)`. */
export async function getContractAt(
  nameOrAbi: string | unknown[],
  address: string
): Promise<ethers.Contract> {
  const abi = Array.isArray(nameOrAbi)
    ? nameOrAbi
    : readAbiByName(getChainId(), nameOrAbi);
  return new ethers.Contract(
    address,
    abi as ethers.ContractInterface,
    getSignerOrProvider()
  );
}

function findFoundryArtifact(directory: string, name: string): string | null {
  if (!existsSync(directory)) return null;
  for (const entry of readdirSync(directory).sort()) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      const nested = findFoundryArtifact(path, name);
      if (nested) return nested;
    } else if (entry === `${name}.json`) return path;
  }
  return null;
}

/** Load a deployable Foundry artifact from out/ without hardhat artifacts. */
export async function getContractFactory(
  name: string
): Promise<ethers.ContractFactory> {
  const artifactPath = findFoundryArtifact(join(CONTRACTS_ROOT, "out"), name);
  if (!artifactPath) {
    throw new Error(
      `Foundry artifact for '${name}' was not found under out/. Run 'forge build' first.`
    );
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode?.object ?? artifact.bytecode;
  if (!Array.isArray(artifact.abi) || !bytecode || bytecode === "0x") {
    throw new Error(`Foundry artifact '${artifactPath}' is not deployable`);
  }
  const signerOrProvider = getSignerOrProvider();
  if (!ethers.Signer.isSigner(signerOrProvider)) {
    throw new Error(`A signer is required to deploy '${name}'`);
  }
  return new ethers.ContractFactory(artifact.abi, bytecode, signerOrProvider);
}
