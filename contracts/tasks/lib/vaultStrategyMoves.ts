import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { BigNumber, Contract, ethers } from "ethers";
import {
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
} from "ethers/lib/utils";

import type { Logger } from "./action";

export type VaultName = "OUSD" | "OETH" | "SuperOETH";
export type MoveKind = "deposit" | "withdraw" | "withdrawAll";

export interface VaultConfig {
  name: VaultName;
  chainId: number;
  vaultDeployment: string;
  checkerDeployment: string;
  profitVariance: string;
  vaultChangeVariance: string;
  providerEnv: "PROVIDER_URL" | "BASE_PROVIDER_URL";
}

export interface ParsedMove {
  kind: MoveKind;
  strategyIdentifier: string;
  amount?: string;
}

export interface ResolvedMove extends ParsedMove {
  strategy: string;
  amountUnits?: BigNumber;
}

export interface CheckerValues {
  expectedProfit: BigNumber;
  profitVariance: BigNumber;
  expectedVaultChange: BigNumber;
  vaultChangeVariance: BigNumber;
}

export interface DerivedValues {
  profit: BigNumber;
  vaultChange: BigNumber;
  supplyChange: BigNumber;
}

export interface BatchCall {
  to: string;
  value: string;
  data: string;
  description: string;
}

export const VAULT_ABI = [
  "function asset() external view returns (address)",
  "function oToken() external view returns (address)",
  "function strategistAddr() external view returns (address)",
  "function rebase() external",
  "function totalValue() external view returns (uint256)",
  "function getAllStrategies() external view returns (address[])",
  "function depositToStrategy(address,address[],uint256[]) external",
  "function withdrawFromStrategy(address,address[],uint256[]) external",
  "function withdrawAllFromStrategy(address) external",
];

export const CHECKER_ABI = [
  "function takeSnapshot() external",
  "function snapshots(address) external view returns (uint256 vaultValue,uint256 totalSupply,uint256 time)",
  "function checkDelta(int256 expectedProfit,int256 profitVariance,int256 expectedVaultChange,int256 vaultChangeVariance) external",
];

export const TOKEN_ABI = [
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
];

const STRATEGY_ABI = [
  "function supportsAsset(address) external view returns (bool)",
];

const VAULT_CONFIGS: Record<VaultName, VaultConfig> = {
  OUSD: {
    name: "OUSD",
    chainId: 1,
    vaultDeployment: "VaultProxy",
    checkerDeployment: "VaultValueChecker",
    profitVariance: "100",
    vaultChangeVariance: "100",
    providerEnv: "PROVIDER_URL",
  },
  OETH: {
    name: "OETH",
    chainId: 1,
    vaultDeployment: "OETHVaultProxy",
    checkerDeployment: "OETHVaultValueChecker",
    profitVariance: "1",
    vaultChangeVariance: "1",
    providerEnv: "PROVIDER_URL",
  },
  SuperOETH: {
    name: "SuperOETH",
    chainId: 8453,
    vaultDeployment: "OETHBaseVaultProxy",
    checkerDeployment: "OETHVaultValueChecker",
    profitVariance: "1",
    vaultChangeVariance: "10",
    providerEnv: "BASE_PROVIDER_URL",
  },
};

const DECIMAL_VALUE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_DECIMAL_VALUE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const FORK_TRANSACTION_OVERRIDES = { gasLimit: 100_000_000 };

export function getVaultConfig(vault: string, chainId: number): VaultConfig {
  const normalized = vault.trim().toLowerCase();
  const config = Object.values(VAULT_CONFIGS).find(
    (candidate) => candidate.name.toLowerCase() === normalized
  );
  if (!config) {
    throw new Error(
      `Unsupported vault "${vault}". Use OUSD, OETH, or SuperOETH`
    );
  }
  if (config.chainId !== chainId) {
    throw new Error(
      `${config.name} is not supported on chain ${chainId}; expected chain ${config.chainId}`
    );
  }
  return config;
}

export function parseMoves(input: string): ParsedMove[] {
  if (!input?.trim()) throw new Error("At least one strategy move is required");

  return input.split(";").map((raw, index) => {
    const entry = raw.trim();
    if (!entry) throw new Error(`Move ${index + 1} is empty`);
    const parts = entry.split(":").map((part) => part.trim());
    const kind = parts[0] as MoveKind;

    if (!(["deposit", "withdraw", "withdrawAll"] as string[]).includes(kind)) {
      throw new Error(
        `Move ${index + 1} has unsupported operation "${parts[0]}"`
      );
    }
    if (!parts[1]) throw new Error(`Move ${index + 1} is missing a strategy`);

    if (kind === "withdrawAll") {
      if (parts.length !== 2) {
        throw new Error(
          `Move ${index + 1} withdrawAll must not include an amount`
        );
      }
      return { kind, strategyIdentifier: parts[1] };
    }

    if (parts.length !== 3 || !parts[2]) {
      throw new Error(`Move ${index + 1} ${kind} requires a positive amount`);
    }
    if (!DECIMAL_VALUE.test(parts[2]) || !/[1-9]/.test(parts[2])) {
      throw new Error(
        `Move ${
          index + 1
        } amount must be a positive decimal without exponent notation`
      );
    }
    return { kind, strategyIdentifier: parts[1], amount: parts[2] };
  });
}

export function parseSignedValue(value: string, label: string): BigNumber {
  if (!SIGNED_DECIMAL_VALUE.test(value)) {
    throw new Error(
      `${label} must be a signed decimal without exponent notation`
    );
  }
  return parseUnits(value, 18);
}

export function parseUnsignedValue(value: string, label: string): BigNumber {
  if (!DECIMAL_VALUE.test(value)) {
    throw new Error(
      `${label} must be a non-negative decimal without exponent notation`
    );
  }
  return parseUnits(value, 18);
}

export function calculateDerivedValues(
  snapshotVaultValue: BigNumber,
  snapshotTotalSupply: BigNumber,
  postVaultValue: BigNumber,
  postTotalSupply: BigNumber
): DerivedValues {
  const vaultChange = postVaultValue.sub(snapshotVaultValue);
  const supplyChange = postTotalSupply.sub(snapshotTotalSupply);
  return {
    vaultChange,
    supplyChange,
    profit: vaultChange.sub(supplyChange),
  };
}

export function resolveCheckerValues({
  config,
  derived,
  expectedProfit,
  profitVariance,
  expectedVaultChange,
  vaultChangeVariance,
  skipFork,
}: {
  config: VaultConfig;
  derived?: DerivedValues;
  expectedProfit?: string;
  profitVariance?: string;
  expectedVaultChange?: string;
  vaultChangeVariance?: string;
  skipFork: boolean;
}): CheckerValues {
  if (skipFork && expectedProfit === undefined) {
    throw new Error("--expected-profit is required when --skip-fork is used");
  }
  if (skipFork && expectedVaultChange === undefined) {
    throw new Error(
      "--expected-vault-change is required when --skip-fork is used"
    );
  }
  if (!derived && !skipFork) {
    throw new Error("Fork-derived Value Checker values are missing");
  }

  return {
    expectedProfit:
      expectedProfit !== undefined
        ? parseSignedValue(expectedProfit, "expectedProfit")
        : derived!.profit,
    profitVariance: parseUnsignedValue(
      profitVariance ?? config.profitVariance,
      "profitVariance"
    ),
    expectedVaultChange:
      expectedVaultChange !== undefined
        ? parseSignedValue(expectedVaultChange, "expectedVaultChange")
        : derived!.vaultChange,
    vaultChangeVariance: parseUnsignedValue(
      vaultChangeVariance ?? config.vaultChangeVariance,
      "vaultChangeVariance"
    ),
  };
}

export async function resolveMoves({
  moves,
  asset,
  assetDecimals,
  activeStrategies,
  provider,
  resolveDeployment,
  log,
}: {
  moves: ParsedMove[];
  asset: string;
  assetDecimals: number;
  activeStrategies: string[];
  provider: ethers.providers.Provider;
  resolveDeployment: (name: string) => Promise<string | undefined>;
  log: Logger;
}): Promise<ResolvedMove[]> {
  const active = new Set(
    activeStrategies.map((address) => address.toLowerCase())
  );
  const supportChecks = new Map<string, boolean | undefined>();

  const resolved: ResolvedMove[] = [];
  for (const move of moves) {
    const strategy = isAddress(move.strategyIdentifier)
      ? getAddress(move.strategyIdentifier)
      : await resolveDeployment(move.strategyIdentifier);
    if (!strategy) {
      throw new Error(
        `Unknown strategy deployment "${move.strategyIdentifier}"`
      );
    }
    const checksummed = getAddress(strategy);
    if (!active.has(checksummed.toLowerCase())) {
      throw new Error(
        `Strategy ${move.strategyIdentifier} (${checksummed}) is not active in the selected vault`
      );
    }

    if (!supportChecks.has(checksummed.toLowerCase())) {
      try {
        const contract = new Contract(checksummed, STRATEGY_ABI, provider);
        supportChecks.set(
          checksummed.toLowerCase(),
          await contract.supportsAsset(asset)
        );
      } catch (error: any) {
        supportChecks.set(checksummed.toLowerCase(), undefined);
        log.warn(
          `Could not query supportsAsset on ${
            move.strategyIdentifier
          } (${checksummed}); relying on vault approval: ${
            error?.reason ?? error?.message ?? error
          }`
        );
      }
    }
    if (supportChecks.get(checksummed.toLowerCase()) === false) {
      throw new Error(
        `Strategy ${move.strategyIdentifier} (${checksummed}) does not support vault asset ${asset}`
      );
    }

    resolved.push({
      ...move,
      strategy: checksummed,
      amountUnits:
        move.amount === undefined
          ? undefined
          : (() => {
              try {
                return parseUnits(move.amount, assetDecimals);
              } catch {
                throw new Error(
                  `Amount ${move.amount} for ${move.strategyIdentifier} exceeds the asset's ${assetDecimals} decimal precision`
                );
              }
            })(),
    });
  }
  return resolved;
}

export function buildBatchCalls({
  vaultAddress,
  checkerAddress,
  asset,
  moves,
  checkerValues,
}: {
  vaultAddress: string;
  checkerAddress: string;
  asset: string;
  moves: ResolvedMove[];
  checkerValues: CheckerValues;
}): BatchCall[] {
  const vault = new ethers.utils.Interface(VAULT_ABI);
  const checker = new ethers.utils.Interface(CHECKER_ABI);
  const calls: BatchCall[] = [
    {
      to: vaultAddress,
      value: "0",
      data: vault.encodeFunctionData("rebase"),
      description: "vault.rebase()",
    },
    {
      to: checkerAddress,
      value: "0",
      data: checker.encodeFunctionData("takeSnapshot"),
      description: "valueChecker.takeSnapshot()",
    },
  ];

  for (const move of moves) {
    if (move.kind === "withdrawAll") {
      calls.push({
        to: vaultAddress,
        value: "0",
        data: vault.encodeFunctionData("withdrawAllFromStrategy", [
          move.strategy,
        ]),
        description: `withdrawAll:${move.strategyIdentifier}`,
      });
    } else {
      const method =
        move.kind === "deposit" ? "depositToStrategy" : "withdrawFromStrategy";
      calls.push({
        to: vaultAddress,
        value: "0",
        data: vault.encodeFunctionData(method, [
          move.strategy,
          [asset],
          [move.amountUnits!],
        ]),
        description: `${move.kind}:${move.strategyIdentifier}:${move.amount}`,
      });
    }
  }

  calls.push({
    to: checkerAddress,
    value: "0",
    data: checker.encodeFunctionData("checkDelta", [
      checkerValues.expectedProfit,
      checkerValues.profitVariance,
      checkerValues.expectedVaultChange,
      checkerValues.vaultChangeVariance,
    ]),
    description: "valueChecker.checkDelta(...)",
  });
  return calls;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local fork port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForFork(
  provider: ethers.providers.JsonRpcProvider,
  child: ChildProcess,
  timeoutMs: number
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local Hardhat fork exited with code ${child.exitCode}`);
    }
    try {
      await provider.send("web3_clientVersion", []);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(
    `Timed out waiting ${timeoutMs}ms for the local Hardhat fork`
  );
}

async function stopFork(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveExit) => child.once("exit", () => resolveExit())),
    new Promise<void>((resolveTimeout) =>
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolveTimeout();
      }, 5_000)
    ),
  ]);
}

export async function runLocalForkSimulation({
  config,
  blockNumber,
  safeAddress,
  vaultAddress,
  checkerAddress,
  asset,
  oToken,
  moves,
  expectedProfit,
  profitVariance,
  expectedVaultChange,
  vaultChangeVariance,
  log,
}: {
  config: VaultConfig;
  blockNumber: number;
  safeAddress: string;
  vaultAddress: string;
  checkerAddress: string;
  asset: string;
  oToken: string;
  moves: ResolvedMove[];
  expectedProfit?: string;
  profitVariance?: string;
  expectedVaultChange?: string;
  vaultChangeVariance?: string;
  log: Logger;
}): Promise<{ derived: DerivedValues; checkerValues: CheckerValues }> {
  const upstreamUrl =
    process.env[config.providerEnv] ||
    (config.chainId === 1 ? process.env.MAINNET_PROVIDER_URL : undefined);
  if (!upstreamUrl) {
    throw new Error(
      `${config.providerEnv} is required for local fork simulation`
    );
  }

  const port = await getFreePort();
  const contractsDir = resolve(__dirname, "../..");
  const hardhatBin = resolve(contractsDir, "node_modules/.bin/hardhat");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FORK: "true",
    IS_TEST: "true",
    FORK_NETWORK_NAME: config.chainId === 8453 ? "base" : "mainnet",
  };
  delete env.HARDHAT_NETWORK;
  delete env.NETWORK_NAME;
  delete env.LOCAL_PROVIDER_URL;
  if (config.chainId === 8453) env.BASE_BLOCK_NUMBER = String(blockNumber);
  else env.BLOCK_NUMBER = String(blockNumber);

  const child = spawn(
    hardhatBin,
    ["node", "--hostname", "127.0.0.1", "--port", String(port), "--no-deploy"],
    { cwd: contractsDir, env, stdio: ["ignore", "pipe", "pipe"] }
  );
  let childOutput = "";
  const captureOutput = (chunk: Buffer) => {
    childOutput = `${childOutput}${chunk.toString()}`.slice(-64 * 1024);
  };
  child.stdout?.on("data", captureOutput);
  child.stderr?.on("data", captureOutput);

  const provider = new ethers.providers.JsonRpcProvider(
    `http://127.0.0.1:${port}`,
    config.chainId
  );
  const forwardSignal = (signal: NodeJS.Signals) => {
    child.kill(signal);
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    process.kill(process.pid, signal);
  };
  const onSigint = () => forwardSignal("SIGINT");
  const onSigterm = () => forwardSignal("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    log.info(`Starting ${config.name} fork simulation at block ${blockNumber}`);
    await waitForFork(provider, child, 45_000);
    await provider.send("hardhat_impersonateAccount", [safeAddress]);
    await provider.send("hardhat_setBalance", [
      safeAddress,
      parseEther("10").toHexString(),
    ]);

    const safeSigner = provider.getSigner(safeAddress);
    const vault = new Contract(vaultAddress, VAULT_ABI, safeSigner);
    const checker = new Contract(checkerAddress, CHECKER_ABI, safeSigner);
    const token = new Contract(oToken, TOKEN_ABI, provider);

    await (await vault.rebase(FORK_TRANSACTION_OVERRIDES)).wait();
    await (await checker.takeSnapshot(FORK_TRANSACTION_OVERRIDES)).wait();

    for (const move of moves) {
      if (move.kind === "deposit") {
        await (
          await vault.depositToStrategy(
            move.strategy,
            [asset],
            [move.amountUnits],
            FORK_TRANSACTION_OVERRIDES
          )
        ).wait();
      } else if (move.kind === "withdraw") {
        await (
          await vault.withdrawFromStrategy(
            move.strategy,
            [asset],
            [move.amountUnits],
            FORK_TRANSACTION_OVERRIDES
          )
        ).wait();
      } else {
        await (
          await vault.withdrawAllFromStrategy(
            move.strategy,
            FORK_TRANSACTION_OVERRIDES
          )
        ).wait();
      }
    }

    const snapshot = await checker.snapshots(safeAddress);
    const postVaultValue = await vault.totalValue();
    const postTotalSupply = await token.totalSupply();
    const derived = calculateDerivedValues(
      snapshot.vaultValue,
      snapshot.totalSupply,
      postVaultValue,
      postTotalSupply
    );
    const checkerValues = resolveCheckerValues({
      config,
      derived,
      expectedProfit,
      profitVariance,
      expectedVaultChange,
      vaultChangeVariance,
      skipFork: false,
    });

    log.info(
      `Fork vault value: ${formatUnits(
        snapshot.vaultValue,
        18
      )} -> ${formatUnits(postVaultValue, 18)}; change ${formatUnits(
        derived.vaultChange,
        18
      )}`
    );
    log.info(
      `Fork token supply: ${formatUnits(
        snapshot.totalSupply,
        18
      )} -> ${formatUnits(postTotalSupply, 18)}; change ${formatUnits(
        derived.supplyChange,
        18
      )}`
    );
    log.info(`Fork-derived profit: ${formatUnits(derived.profit, 18)}`);

    await (
      await checker.checkDelta(
        checkerValues.expectedProfit,
        checkerValues.profitVariance,
        checkerValues.expectedVaultChange,
        checkerValues.vaultChangeVariance,
        FORK_TRANSACTION_OVERRIDES
      )
    ).wait();
    log.info("Fork Value Checker validation succeeded");
    return { derived, checkerValues };
  } catch (error: any) {
    const sanitized = childOutput
      .replaceAll(upstreamUrl, "[redacted provider URL]")
      .split("\n")
      .slice(-12)
      .join("\n");
    if (sanitized.trim()) log.warn(`Local fork output:\n${sanitized}`);
    throw error;
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    await stopFork(child);
  }
}
