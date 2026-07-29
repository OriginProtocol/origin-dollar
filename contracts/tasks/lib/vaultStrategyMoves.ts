import { BigNumber, Contract, ethers } from "ethers";
import {
  formatUnits,
  getAddress,
  hexValue,
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
  },
  OETH: {
    name: "OETH",
    chainId: 1,
    vaultDeployment: "OETHVaultProxy",
    checkerDeployment: "OETHVaultValueChecker",
    profitVariance: "1",
    vaultChangeVariance: "1",
  },
  SuperOETH: {
    name: "SuperOETH",
    chainId: 8453,
    vaultDeployment: "OETHBaseVaultProxy",
    checkerDeployment: "OETHVaultValueChecker",
    profitVariance: "1",
    vaultChangeVariance: "10",
  },
};

const DECIMAL_VALUE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_DECIMAL_VALUE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const SIMULATE_METHOD = "eth_simulateV1";
/// Covers gas for the spoofed `from: safe` calls only; never moves real value.
const SIMULATED_SAFE_BALANCE = parseEther("10").toHexString();
const ERROR_STRING_SELECTOR = "0x08c379a0";

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

/// Shared by the proposed batch and the simulation's derive pass so a move is only ever encoded
/// one way.
function buildMoveCalls(
  vaultAddress: string,
  asset: string,
  moves: ResolvedMove[]
): BatchCall[] {
  const vault = new ethers.utils.Interface(VAULT_ABI);
  return moves.map((move) => {
    if (move.kind === "withdrawAll") {
      return {
        to: vaultAddress,
        value: "0",
        data: vault.encodeFunctionData("withdrawAllFromStrategy", [
          move.strategy,
        ]),
        description: `withdrawAll:${move.strategyIdentifier}`,
      };
    }
    const method =
      move.kind === "deposit" ? "depositToStrategy" : "withdrawFromStrategy";
    return {
      to: vaultAddress,
      value: "0",
      data: vault.encodeFunctionData(method, [
        move.strategy,
        [asset],
        [move.amountUnits!],
      ]),
      description: `${move.kind}:${move.strategyIdentifier}:${move.amount}`,
    };
  });
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
    ...buildMoveCalls(vaultAddress, asset, moves),
  ];

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

interface SimulatedCall {
  status: string;
  returnData: string;
  gasUsed: string;
  error?: { code?: number; message?: string; data?: string };
}

/// A provider that cannot simulate is a hard stop, not a reason to propose an unchecked batch, so
/// this spells out the one supported way forward instead of letting a raw -32601 surface.
function simulationRpcError(error: any): Error {
  const code = error?.error?.code ?? error?.code;
  const message: string =
    error?.error?.message ?? error?.message ?? String(error);
  if (code === -32601 || /method not (found|supported)/i.test(message)) {
    return new Error(
      `The configured RPC does not support ${SIMULATE_METHOD} (${message}). ` +
        `Point the network at a provider that implements it, or re-run with --skip-fork plus ` +
        `explicit --expected-profit and --expected-vault-change.`
    );
  }
  return new Error(`${SIMULATE_METHOD} failed: ${message}`);
}

function decodeRevert(call: SimulatedCall): string {
  const data = call.error?.data ?? call.returnData;
  if (data && data.startsWith(ERROR_STRING_SELECTOR)) {
    try {
      return ethers.utils.defaultAbiCoder.decode(
        ["string"],
        `0x${data.slice(10)}`
      )[0];
    } catch {
      // Not a well-formed Error(string); fall through to the raw payload.
    }
  }
  return call.error?.message ?? `reverted with ${data || "no return data"}`;
}

function assertCallsSucceeded(simulated: SimulatedCall[], calls: BatchCall[]) {
  simulated.forEach((call, index) => {
    if (call.status === "0x1") return;
    throw new Error(
      `Simulation failed at step ${index + 1} of ${simulated.length} (${
        calls[index].description
      }): ${decodeRevert(call)}`
    );
  });
}

/// Runs `calls` in order inside a single simulated block built on `blockTag`, as if the Safe had
/// sent each one. Nothing is broadcast and nothing persists past the response.
async function simulateCalls({
  provider,
  safeAddress,
  blockTag,
  calls,
}: {
  provider: ethers.providers.Provider;
  safeAddress: string;
  blockTag: string;
  calls: BatchCall[];
}): Promise<SimulatedCall[]> {
  let response: any;
  try {
    response = await (provider as ethers.providers.JsonRpcProvider).send(
      SIMULATE_METHOD,
      [
        {
          blockStateCalls: [
            {
              calls: calls.map((call) => ({
                from: safeAddress,
                to: call.to,
                value: hexValue(BigNumber.from(call.value)),
                data: call.data,
              })),
              stateOverrides: {
                [safeAddress]: { balance: SIMULATED_SAFE_BALANCE },
              },
            },
          ],
          validation: false,
          traceTransfers: false,
        },
        blockTag,
      ]
    );
  } catch (error: any) {
    throw simulationRpcError(error);
  }

  const simulated: SimulatedCall[] | undefined = response?.[0]?.calls;
  if (!Array.isArray(simulated) || simulated.length !== calls.length) {
    throw new Error(
      `${SIMULATE_METHOD} returned ${simulated?.length ?? "no"} results for ${
        calls.length
      } calls`
    );
  }
  return simulated;
}

/**
 * Derive the Vault Value Checker bounds by simulating the proposal with `eth_simulateV1`, then
 * replay the assembled batch to prove it passes `checkDelta`.
 *
 * One request behaves like a single throwaway fork: calls inside a block run in order and their
 * writes stack, and a later block in the same request still sees them. Nothing survives the
 * response, so the validation pass replays the whole batch from the top rather than continuing
 * from the derive pass — and both passes are pinned to one block, because at `latest` the chain
 * could advance between the two round-trips and validate against different state than we derived
 * from.
 *
 * Failure modes worth knowing about:
 *
 * - `eth_simulateV1` is a hard dependency. A provider without it answers -32601, and this throws
 *   with instructions rather than proposing an unsimulated batch. `--skip-fork` with explicit
 *   expected values is the deliberate, visible escape hatch.
 * - `validation: false` is load-bearing. Every call is spoofed `from` the Safe with no signature,
 *   nonce or balance check, and the balance override exists only to pay gas. Turning validation on
 *   rejects the whole approach.
 * - Providers cap calls per block, blocks per request, and total simulated gas. A three-call batch
 *   measures ~1.3M gas, so a long `--moves` list is the realistic way to hit a cap. Caps surface as
 *   a request-level error rather than a per-call revert, so they land in `simulationRpcError` and
 *   never in `assertCallsSucceeded`.
 * - The batch executes hours later, once two Safe owners have confirmed. For AMO strategies
 *   `expectedVaultChange` tracks pool state, so the tight per-vault defaults (100 OUSD, 1 OETH) can
 *   make `checkDelta` revert on execution if the pool has moved since. That fails safe, but it
 *   burns a Safe nonce and gas — pass `--vault-change-variance` for AMO moves.
 * - This simulates the calls, not the Safe wrapper. Each one runs directly as the Safe, so a Safe
 *   Guard, `safeTxGas` exhaustion or a MultiSend-level failure is not exercised. Simulating the
 *   real `execTransaction` is possible — override the Safe's threshold slot to 1 and pass an
 *   approved-hash signature from an owner — but is deliberately out of scope here.
 */
export async function runSimulation({
  config,
  provider,
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
  provider: ethers.providers.Provider;
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
  const vault = new ethers.utils.Interface(VAULT_ABI);
  const checker = new ethers.utils.Interface(CHECKER_ABI);
  const token = new ethers.utils.Interface(TOKEN_ABI);
  const blockTag = hexValue(blockNumber);

  // Rebase and snapshot exactly as the batch will, run the moves, then read the two values
  // `checkDelta` compares. The snapshot is read back from the checker rather than recomputed, so
  // the deltas are measured against the same storage the on-chain check will read.
  const derivePlan: BatchCall[] = [
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
    {
      to: checkerAddress,
      value: "0",
      data: checker.encodeFunctionData("snapshots", [safeAddress]),
      description: "valueChecker.snapshots(safe)",
    },
    ...buildMoveCalls(vaultAddress, asset, moves),
    {
      to: vaultAddress,
      value: "0",
      data: vault.encodeFunctionData("totalValue"),
      description: "vault.totalValue()",
    },
    {
      to: oToken,
      value: "0",
      data: token.encodeFunctionData("totalSupply"),
      description: "oToken.totalSupply()",
    },
  ];

  log.info(
    `Simulating ${config.name} strategy moves at block ${blockNumber} with ${SIMULATE_METHOD}`
  );
  const derivePass = await simulateCalls({
    provider,
    safeAddress,
    blockTag,
    calls: derivePlan,
  });
  assertCallsSucceeded(derivePass, derivePlan);

  const snapshot = checker.decodeFunctionResult(
    "snapshots",
    derivePass[2].returnData
  );
  const postVaultValue: BigNumber = vault.decodeFunctionResult(
    "totalValue",
    derivePass[derivePass.length - 2].returnData
  )[0];
  const postTotalSupply: BigNumber = token.decodeFunctionResult(
    "totalSupply",
    derivePass[derivePass.length - 1].returnData
  )[0];

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
    `Simulated vault value: ${formatUnits(
      snapshot.vaultValue,
      18
    )} -> ${formatUnits(postVaultValue, 18)}; change ${formatUnits(
      derived.vaultChange,
      18
    )}`
  );
  log.info(
    `Simulated token supply: ${formatUnits(
      snapshot.totalSupply,
      18
    )} -> ${formatUnits(postTotalSupply, 18)}; change ${formatUnits(
      derived.supplyChange,
      18
    )}`
  );
  log.info(`Simulation-derived profit: ${formatUnits(derived.profit, 18)}`);

  // Replay the batch that will actually be proposed, from the same block. A second request starts
  // from unmodified state, so this re-runs rebase and takeSnapshot instead of continuing above.
  const batch = buildBatchCalls({
    vaultAddress,
    checkerAddress,
    asset,
    moves,
    checkerValues,
  });
  const validationPass = await simulateCalls({
    provider,
    safeAddress,
    blockTag,
    calls: batch,
  });
  assertCallsSucceeded(validationPass, batch);
  const gasUsed = validationPass.reduce(
    (total, call) => total.add(BigNumber.from(call.gasUsed)),
    BigNumber.from(0)
  );
  log.info(
    `Value Checker validation succeeded; batch simulated in ${gasUsed.toString()} gas`
  );

  return { derived, checkerValues };
}
