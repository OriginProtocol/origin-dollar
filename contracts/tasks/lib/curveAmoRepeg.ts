import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BigNumber, Contract, ethers } from "ethers";
import {
  formatEther,
  formatUnits,
  getAddress,
  hexValue,
  id,
  parseEther,
  parseUnits,
} from "ethers/lib/utils";
import type { Logger } from "./action";
import type { BatchCall } from "./vaultStrategyMoves";
import {
  assertCallsSucceeded,
  decodeRevert,
  simulateCalls,
} from "./simulation";

export const DEFAULT_TRIGGER_PRICE = "0.9997";

export const REPEG_ABI = [
  "function vault() view returns(address)",
  "function amo() view returns(address)",
  "function checker() view returns(address)",
  "function safeContract() view returns(address)",
  "function maxProfitVariance() view returns(uint256)",
  "function maxVaultChangeVariance() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function hasRole(bytes32,address) view returns(bool)",
  "function repeg(uint256,int256,int256,int256,int256,uint256,uint256)",
];

const VAULT = new ethers.utils.Interface([
  "function oToken() view returns(address)",
  "function strategistAddr() view returns(address)",
  "function rebasePaused() view returns(bool)",
  "function rebase()",
  "function totalValue() view returns(uint256)",
]);

const CHECKER = new ethers.utils.Interface([
  "function vault() view returns(address)",
  "function ousd() view returns(address)",
  "function takeSnapshot()",
  "function snapshots(address) view returns(uint256 vaultValue,uint256 totalSupply,uint256 time)",
]);

const AMO = new ethers.utils.Interface([
  "function vaultAddress() view returns(address)",
  "function curvePool() view returns(address)",
  "function gauge() view returns(address)",
  "function removeAndBurnOTokens(uint256)",
]);

const ERC20 = new ethers.utils.Interface([
  "function decimals() view returns(uint8)",
  "function totalSupply() view returns(uint256)",
  "function balanceOf(address) view returns(uint256)",
]);

const POOL = new ethers.utils.Interface([
  "function coins(uint256) view returns(address)",
  "function get_dy(int128,int128,uint256) view returns(uint256)",
]);

const SAFE = new ethers.utils.Interface([
  "function isModuleEnabled(address) view returns(bool)",
]);

const MODULE = new ethers.utils.Interface(REPEG_ABI);

const LP_STEP = parseEther("0.01");

const MAX_SEARCH_STEPS = 128;

const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

/** Chain-specific deployment bindings and the Curve sell-quote direction. */
export interface RepegProfile {
  asset: string;
  chainId: number;
  directory: string;
  vaultDeployment: string;
  tokenDeployment: string;
  amoDeployment: string;
  checkerDeployment: string;
  moduleDeployment: string;
  pool: string;
  quoteAsset: string;
  /** Quote-asset precision: 6 for USDC, 18 for WETH. */
  quoteDecimals: number;
  /** Pool input index for selling one 18-decimal OToken. */
  tokenIndex: number;
  /** Pool output index for the quote asset; SuperOETH reverses the mainnet order. */
  quoteIndex: number;
}

export const REPEG_PROFILES: RepegProfile[] = [
  {
    asset: "OUSD",
    chainId: 1,
    directory: "mainnet",
    vaultDeployment: "VaultProxy",
    tokenDeployment: "OUSDProxy",
    amoDeployment: "OUSDCurveAMOProxy",
    checkerDeployment: "VaultValueChecker",
    moduleDeployment: "OUSDCurveAmoRepegModule",
    pool: "0x6d18E1a7faeB1F0467A77C0d293872ab685426dc",
    quoteAsset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    quoteDecimals: 6,
    tokenIndex: 0,
    quoteIndex: 1,
  },
  {
    asset: "OETH",
    chainId: 1,
    directory: "mainnet",
    vaultDeployment: "OETHVaultProxy",
    tokenDeployment: "OETHProxy",
    amoDeployment: "OETHCurveAMOProxy",
    checkerDeployment: "OETHVaultValueChecker",
    moduleDeployment: "OETHCurveAmoRepegModule",
    pool: "0xcc7d5785AD5755B6164e21495E07aDb0Ff11C2A8",
    quoteAsset: WETH_ETHEREUM,
    quoteDecimals: 18,
    tokenIndex: 0,
    quoteIndex: 1,
  },
  {
    asset: "SuperOETH",
    chainId: 8453,
    directory: "base",
    vaultDeployment: "OETHBaseVaultProxy",
    tokenDeployment: "OETHBaseProxy",
    amoDeployment: "OETHBaseCurveAMOProxy",
    checkerDeployment: "OETHVaultValueChecker",
    moduleDeployment: "SuperOETHCurveAmoRepegModule",
    pool: "0x302A94E3C28c290EAF2a4605FC52e11Eb915f378",
    quoteAsset: "0x4200000000000000000000000000000000000006",
    quoteDecimals: 18,
    tokenIndex: 1,
    quoteIndex: 0,
  },
];

/**
 * Resolves an asset profile and rejects execution on another chain.
 * @param asset - Case-insensitive OUSD, OETH, or SuperOETH name.
 * @param chainId - Chain on which the action will execute.
 * @returns The matching deployment and pool-quote configuration.
 * @throws If the asset is unsupported or its configured chain differs.
 */
export function getRepegProfile(asset: string, chainId: number): RepegProfile {
  const profile = REPEG_PROFILES.find(
    (p) => p.asset.toLowerCase() === asset.trim().toLowerCase()
  );
  if (!profile)
    throw new Error("Unsupported asset; use OUSD, OETH, or SuperOETH");
  if (profile.chainId !== chainId)
    throw new Error(
      `${profile.asset} requires chain ${profile.chainId}, received ${chainId}`
    );
  return profile;
}

/**
 * Converts a sell-price target to raw quote-asset units without floating point.
 * @param value - Exact decimal string for quote asset received per one OToken.
 * @param decimals - Quote precision: USDC uses 6 decimals and WETH uses 18.
 * @returns A positive raw quote amount below one whole quote token.
 * @throws If the string, precision, or exclusive zero-to-one range is invalid.
 */
export function parseSellPrice(value: string, decimals: number): BigNumber {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))
    throw new Error("sellPrice must be an exact decimal string");
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    throw new Error(`sellPrice supports at most ${decimals} decimals`);
  const target = parseUnits(value, decimals);
  if (target.lte(0) || target.gte(parseUnits("1", decimals)))
    throw new Error("sellPrice must be greater than zero and less than one");
  return target;
}

/**
 * Parses the strict execution threshold in raw quote-asset units.
 * @param value - Exact decimal quote amount below which execution may proceed.
 * @param decimals - Quote precision: USDC uses 6 decimals and WETH uses 18.
 * @param target - Parsed sellPrice output in the same raw quote-asset units.
 * @returns A positive threshold no greater than the sell-price target.
 * @throws If its decimal format, precision, range, or ordering is invalid.
 * @remarks A quote equal to the threshold skips execution. Setting the threshold
 * equal to the target allows execution for any quote below that target.
 */
export function parseTriggerPrice(
  value: string,
  decimals: number,
  target: BigNumber
): BigNumber {
  let trigger: BigNumber;
  try {
    trigger = parseSellPrice(value, decimals);
  } catch (error) {
    throw new Error(
      (error as Error).message.replace(/sellPrice/g, "triggerPrice")
    );
  }
  if (trigger.gt(target))
    throw new Error("triggerPrice must not exceed sellPrice");
  return trigger;
}

/** A simulated sell quote, or the strategy's explicit peg-overshoot boundary. */
export type TrialQuote = { quote: BigNumber } | { overshot: true };

/**
 * Finds the smallest sufficient withdrawal on a 0.01 LP-token grid.
 * @param maxLp - Staked LP balance, in raw 18-decimal LP-token units.
 * @param target - Minimum output for selling one OToken, in raw quote units.
 * @param trial - Replays one LP candidate against the same source state.
 * @returns A raw 18-decimal LP amount no larger than the staked balance.
 * @throws If liquidity or the search limit is exhausted, the target requires a
 * peg overshoot, or a trial fails for another reason.
 * @remarks Quotes must increase monotonically up to the peg-overshoot boundary.
 * Trial callbacks must propagate other simulation failures rather than treating
 * them as oversized candidates. This function does not broadcast transactions.
 */
export async function sizeRepeg(
  maxLp: BigNumber,
  target: BigNumber,
  trial: (lp: BigNumber) => Promise<TrialQuote>
): Promise<BigNumber> {
  const maxUnits = maxLp.div(LP_STEP);
  if (maxUnits.isZero())
    throw new Error("AMO has insufficient staked LP tokens");
  let low = BigNumber.from(0),
    high = BigNumber.from(1000000);
  if (high.gt(maxUnits)) high = maxUnits;
  let result: TrialQuote | undefined;
  let steps = 0;
  const evaluate = async (units: BigNumber) => {
    if (++steps > MAX_SEARCH_STEPS)
      throw new Error("LP sizing exceeded the search limit");
    return trial(units.mul(LP_STEP));
  };
  while (true) {
    result = await evaluate(high);
    if ("overshot" in result || result.quote.gte(target)) break;
    low = high;
    if (high.eq(maxUnits))
      throw new Error("Target is unreachable with the AMO's staked LP balance");
    high = high.mul(2);
    if (high.gt(maxUnits)) high = maxUnits;
  }
  while (high.sub(low).gt(1)) {
    const mid = high.add(low).div(2),
      candidate = await evaluate(mid);
    if ("overshot" in candidate || candidate.quote.gte(target)) {
      high = mid;
      result = candidate;
    } else low = mid;
  }
  if (!result || "overshot" in result)
    throw new Error(
      "Target is unreachable without overshooting the pool balance"
    );
  return high.mul(LP_STEP);
}

/** Checker amounts in 18-decimal vault accounting units: USD or ETH. */
export interface RepegCheckerValues {
  /** Vault change less supply change; must be strictly positive. */
  expectedProfit: BigNumber;
  /** At most the deployment cap and expected profit minus one accounting wei. */
  profitVariance: BigNumber;
  /** Nonpositive change in vault value after the burn. */
  expectedVaultChange: BigNumber;
  /** Deployed maximum permitted deviation from the expected vault change. */
  vaultChangeVariance: BigNumber;
}

/**
 * Derives the checker's expected changes and a strictly positive profit floor.
 * @param snapshotVault - Vault value recorded by the simulated checker snapshot.
 * @param snapshotSupply - OToken supply recorded by that same snapshot.
 * @param endVault - Vault value after the simulated burn.
 * @param endSupply - OToken supply after the simulated burn.
 * @param profitCap - Reviewed profit-variance cap read from the module.
 * @param vaultCap - Reviewed vault-change-variance cap read from the module.
 * @returns Expected values and variances in 18-decimal vault accounting units.
 * @throws If profit is zero or negative, or the burn increases vault value.
 * @remarks Profit equals vault change minus supply change. Profit variance is
 * min(profitCap, profit - 1), retaining at least one accounting wei of profit.
 * The unit is USD for OUSD and ETH for OETH/SuperOETH; gas costs are excluded.
 */
export function deriveRepegValues(
  snapshotVault: BigNumber,
  snapshotSupply: BigNumber,
  endVault: BigNumber,
  endSupply: BigNumber,
  profitCap: BigNumber,
  vaultCap: BigNumber
): RepegCheckerValues {
  const expectedVaultChange = endVault.sub(snapshotVault),
    expectedProfit = expectedVaultChange.sub(endSupply.sub(snapshotSupply));
  if (expectedProfit.lte(0))
    throw new Error("Simulated burn must produce strictly positive profit");
  if (expectedVaultChange.gt(0))
    throw new Error("Simulated burn unexpectedly increases vault value");
  const availableVariance = expectedProfit.sub(1);
  return {
    expectedProfit,
    expectedVaultChange,
    profitVariance: availableVariance.lt(profitCap)
      ? availableVariance
      : profitCap,
    vaultChangeVariance: vaultCap,
  };
}

interface Addresses {
  module: string;
  vault: string;
  token: string;
  amo: string;
  checker: string;
}

interface State extends Addresses {
  safe: string;
  gauge: string;
  nonce: BigNumber;
  profitCap: BigNumber;
  vaultCap: BigNumber;
  maxLp: BigNumber;
}

/** Simulated burn and checker request tied to a canonical source block. */
export interface RepegPlan {
  blockNumber: number;
  blockHash: string;
  /** Withdrawal amount in raw 18-decimal LP-token units. */
  lpTokens: BigNumber;
  /** Expected supply reduction in raw 18-decimal OToken units. */
  burn: BigNumber;
  /** Output for selling one OToken, in the profile's raw quote-asset units. */
  quoteBefore: BigNumber;
  /** Post-burn output in the same units as quoteBefore. */
  quoteAfter: BigNumber;
  values: RepegCheckerValues;
  /** Module request nonce observed at the source block. */
  nonce: BigNumber;
  /** Unix seconds: source block timestamp plus 300 seconds. */
  deadline: number;
}

/** Encodes a zero-value simulation call without submitting it. */
const call = (
  to: string,
  iface: ethers.utils.Interface,
  method: string,
  args: unknown[] = []
): BatchCall => ({
  to,
  value: "0",
  data: iface.encodeFunctionData(method, args),
  description: method,
});

/** Reads and decodes the first result of a contract view at a pinned block. */
async function read(
  provider: ethers.providers.Provider,
  to: string,
  iface: ethers.utils.Interface,
  method: string,
  args: unknown[],
  blockNumber: number
): Promise<any> {
  const data = await provider.call(
    { to, data: iface.encodeFunctionData(method, args) },
    blockNumber
  );
  return iface.decodeFunctionResult(method, data)[0];
}

const same = (a: string, b: string) => getAddress(a) === getAddress(b);

function assertAddress(actual: string, expected: string, label: string) {
  if (!same(actual, expected))
    throw new Error(`${label} mismatch: ${actual} != ${expected}`);
}

/**
 * Loads per-instance addresses from committed deployment descriptors.
 * @param profile - Asset and network whose deployment files should be read.
 * @returns Checksummed module, vault, token, AMO, and checker addresses.
 * @throws If a descriptor is missing, unreadable, malformed, or has an invalid address.
 * @remarks This reads local files only; it neither deploys nor enables a module.
 */
export function loadRepegAddresses(profile: RepegProfile): Addresses {
  const address = (name: string) => {
    const file = join(
      __dirname,
      "..",
      "..",
      "deployments",
      profile.directory,
      `${name}.json`
    );
    let deployment: { address: string };
    try {
      deployment = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      throw new Error(
        `Deployment ${name} is unavailable on ${profile.directory}; deploy, export its descriptor and enable the module before running this action`
      );
    }
    return getAddress(deployment.address);
  };
  return {
    module: address(profile.moduleDeployment),
    vault: address(profile.vaultDeployment),
    token: address(profile.tokenDeployment),
    amo: address(profile.amoDeployment),
    checker: address(profile.checkerDeployment),
  };
}

/**
 * Reads and validates module permissions and pool bindings at one source block.
 * @param provider - Provider for the selected chain.
 * @param profile - Expected deployment identities, coin order, and decimals.
 * @param addresses - Per-instance addresses loaded from deployment descriptors.
 * @param operator - Talos signer that must hold the module operator role.
 * @param block - Block number to use for all permission and balance reads.
 * @returns Validated bindings, request nonce, variance caps, and staked LP balance.
 * @throws If reads fail or module code, bindings, permissions, caps, or decimals are invalid.
 * @remarks This validates existing contracts; it changes no chain state.
 */
async function loadState(
  provider: ethers.providers.Provider,
  profile: RepegProfile,
  addresses: Addresses,
  operator: string,
  block: number
): Promise<State> {
  const { module, vault, amo, checker, token } = addresses;
  const moduleRead = (method: string, args: unknown[] = []) =>
    read(provider, module, MODULE, method, args, block);
  const [code, bindings, safe, profitCap, vaultCap, nonce, authorized] =
    await Promise.all([
      provider.getCode(module, block),
      Promise.all(["vault", "amo", "checker"].map((m) => moduleRead(m))),
      moduleRead("safeContract"),
      moduleRead("maxProfitVariance"),
      moduleRead("maxVaultChangeVariance"),
      moduleRead("nonce"),
      moduleRead("hasRole", [id("OPERATOR_ROLE"), operator]),
    ]);
  if (code === "0x") throw new Error("Repegging module is not deployed");
  [vault, amo, checker].forEach((address, index) =>
    assertAddress(
      bindings[index],
      address,
      ["Module vault", "Module AMO", "Module checker"][index]
    )
  );
  if (!authorized)
    throw new Error("Talos signer does not have the module's operator role");
  if (profitCap.lte(0) || vaultCap.lte(0))
    throw new Error("Module variance caps must be positive");
  const [
    strategist,
    oToken,
    amoVault,
    pool,
    gauge,
    checkerVault,
    checkerToken,
    enabled,
  ] = await Promise.all([
    read(provider, vault, VAULT, "strategistAddr", [], block),
    read(provider, vault, VAULT, "oToken", [], block),
    read(provider, amo, AMO, "vaultAddress", [], block),
    read(provider, amo, AMO, "curvePool", [], block),
    read(provider, amo, AMO, "gauge", [], block),
    read(provider, checker, CHECKER, "vault", [], block),
    read(provider, checker, CHECKER, "ousd", [], block),
    read(provider, safe, SAFE, "isModuleEnabled", [module], block),
  ]);
  assertAddress(strategist, safe, "Strategist Safe");
  assertAddress(oToken, token, "Vault token");
  assertAddress(amoVault, vault, "AMO vault");
  assertAddress(pool, profile.pool, "Curve pool");
  assertAddress(checkerVault, vault, "Checker vault");
  assertAddress(checkerToken, token, "Checker token");
  if (!enabled) throw new Error("Repegging module is not enabled on its Safe");
  const [coin, quoteCoin, tokenDecimals, quoteDecimals, maxLp] =
    await Promise.all([
      read(provider, pool, POOL, "coins", [profile.tokenIndex], block),
      read(provider, pool, POOL, "coins", [profile.quoteIndex], block),
      read(provider, token, ERC20, "decimals", [], block),
      read(provider, profile.quoteAsset, ERC20, "decimals", [], block),
      read(provider, gauge, ERC20, "balanceOf", [amo], block),
    ]);
  assertAddress(coin, token, "Pool OToken");
  assertAddress(quoteCoin, profile.quoteAsset, "Pool quote asset");
  if (tokenDecimals !== 18 || quoteDecimals !== profile.quoteDecimals)
    throw new Error("Unexpected pool token decimals");
  return { ...addresses, safe, gauge, profitCap, vaultCap, nonce, maxLp };
}

/** Encodes get_dy for one OToken using the profile's verified pool coin order. */
function quoteCall(profile: RepegProfile): BatchCall {
  return call(profile.pool, POOL, "get_dy", [
    profile.tokenIndex,
    profile.quoteIndex,
    parseEther("1"),
  ]);
}

/** Decodes the raw quote output: USDC has 6 decimals and WETH has 18. */
const decodeQuote = (data: string): BigNumber =>
  POOL.decodeFunctionResult("get_dy", data)[0];

/**
 * Runs ordered, nonpersistent calls at one pinned block with no submission fallback.
 * @param provider - RPC provider implementing eth_simulateV1.
 * @param from - Spoofed Safe sender for derivation, or actual relayer for preflight.
 * @param block - Source block for the simulated block.
 * @param calls - Ordered calls whose writes are visible to subsequent calls.
 * @param overrideBalance - Adds virtual gas funding only for derivation; false for module preflight.
 * @returns Raw per-call results, which callers must check for EVM reverts.
 * @throws If the provider cannot simulate or returns an invalid response.
 */
async function simulate(
  provider: ethers.providers.Provider,
  from: string,
  block: number,
  calls: BatchCall[],
  overrideBalance = true
) {
  return simulateCalls({
    provider,
    safeAddress: from,
    blockTag: hexValue(block),
    calls,
    overrideBalance,
    allowExplicitValues: false,
  });
}

class StateChanged extends Error {}

/**
 * Sizes and derives a burn request against a single canonical chain snapshot.
 * @param provider - Read/simulation provider for the selected chain.
 * @param profile - Asset's quote direction, precision, and pool identity.
 * @param state - Bindings, nonce, caps, and staked LP balance validated at block.
 * @param target - Minimum one-OToken sell output in raw quote-asset units.
 * @param block - Canonical source block used for every sizing and derivation pass.
 * @param trigger - Strict execution threshold in raw quote-asset units, at most target.
 * @returns A checker request, or undefined when the pre- or post-rebase quote is
 * at or above the trigger, even if it remains below the sell-price target.
 * @throws If rebase is paused, sizing or simulation fails, profit is not positive,
 * the target is unreachable, or the source block is reorganized.
 * @remarks Rebase, snapshot, burn, and balance reads are simulated as the Safe;
 * nothing is broadcast. The deadline is the source block timestamp plus 300 seconds.
 */
export async function buildRepegPlan(
  provider: ethers.providers.Provider,
  profile: RepegProfile,
  state: State,
  target: BigNumber,
  block: ethers.providers.Block,
  trigger: BigNumber
): Promise<RepegPlan | undefined> {
  const quote = quoteCall(profile);
  const current = (await read(
    provider,
    profile.pool,
    POOL,
    "get_dy",
    [profile.tokenIndex, profile.quoteIndex, parseEther("1")],
    block.number
  )) as BigNumber;
  if (current.gte(trigger)) return undefined;
  if (
    await read(provider, state.vault, VAULT, "rebasePaused", [], block.number)
  )
    throw new Error("Vault rebase is paused; this action cannot unpause it");
  const rebase = call(state.vault, VAULT, "rebase");
  const rebased = await simulate(provider, state.safe, block.number, [
    rebase,
    quote,
  ]);
  assertCallsSucceeded(rebased, [rebase, quote]);
  if (decodeQuote(rebased[1].returnData).gte(trigger)) return undefined;
  const lpTokens = await sizeRepeg(state.maxLp, target, async (lp) => {
    const calls = [
      rebase,
      call(state.amo, AMO, "removeAndBurnOTokens", [lp]),
      quote,
    ];
    const result = await simulate(provider, state.safe, block.number, calls);
    if (result[0].status !== "0x1")
      assertCallsSucceeded(result.slice(0, 1), calls.slice(0, 1));
    if (
      result[1].status !== "0x1" &&
      decodeRevert(result[1]) === "OTokens overshot peg"
    )
      return { overshot: true };
    assertCallsSucceeded(result, calls);
    return { quote: decodeQuote(result[2].returnData) };
  });
  const calls = [
    rebase,
    call(state.checker, CHECKER, "takeSnapshot"),
    call(state.checker, CHECKER, "snapshots", [state.safe]),
    call(state.amo, AMO, "removeAndBurnOTokens", [lpTokens]),
    call(state.vault, VAULT, "totalValue"),
    call(state.token, ERC20, "totalSupply"),
    quote,
  ];
  const result = await simulate(provider, state.safe, block.number, calls);
  assertCallsSucceeded(result, calls);
  const snapshot = CHECKER.decodeFunctionResult(
    "snapshots",
    result[2].returnData
  );
  const endVault = VAULT.decodeFunctionResult(
      "totalValue",
      result[4].returnData
    )[0],
    endSupply = ERC20.decodeFunctionResult(
      "totalSupply",
      result[5].returnData
    )[0];
  const values = deriveRepegValues(
    snapshot.vaultValue,
    snapshot.totalSupply,
    endVault,
    endSupply,
    state.profitCap,
    state.vaultCap
  );
  const quoteAfter = decodeQuote(result[6].returnData);
  if (quoteAfter.lt(target))
    throw new Error("Derived burn does not meet the target quote");
  const canonical = await provider.getBlock(block.number);
  if (!canonical || canonical.hash !== block.hash)
    throw new StateChanged("Sizing block was reorganized");
  return {
    blockNumber: block.number,
    blockHash: block.hash,
    lpTokens,
    burn: snapshot.totalSupply.sub(endSupply),
    quoteBefore: current,
    quoteAfter,
    values,
    nonce: state.nonce,
    deadline: block.timestamp + 300,
  };
}

/** Produces the shared argument order for calldata encoding and named submission. */
function repegArguments(plan: RepegPlan): ethers.BigNumberish[] {
  const v = plan.values;
  return [
    plan.lpTokens,
    v.expectedProfit,
    v.profitVariance,
    v.expectedVaultChange,
    v.vaultChangeVariance,
    plan.nonce,
    plan.deadline,
  ];
}

/**
 * Encodes the exact typed module call for a simulated request.
 * @param plan - LP amount, checker values, request nonce, and expiry to encode.
 * @returns Hex calldata for CurveAmoRepegModule.repeg; no transaction is sent.
 * @throws If a request field cannot be encoded in the module ABI.
 */
export function encodeRepeg(plan: RepegPlan): string {
  return MODULE.encodeFunctionData("repeg", repegArguments(plan));
}

/**
 * Preflights the exact module call from the relayer against fresh chain state.
 * @param provider - Provider supporting stateful RPC simulation.
 * @param operator - Actual Talos signer used as the simulation sender.
 * @param profile - Pool sell direction and quote precision.
 * @param state - Bound module address for the asset.
 * @param plan - Previously sized request, including nonce and deadline.
 * @param target - Minimum one-OToken sell output in raw quote-asset units.
 * @param trigger - Strict execution threshold in the same raw quote-asset units.
 * @returns ready after success, or skip if the fresh starting quote is at or above
 * trigger; the post-burn quote must still meet the independent sell-price target.
 * @throws If the request expired, module execution fails, the final quote misses
 * target, or the RPC/quote calls fail.
 * @remarks No state overrides are applied. This exercises operator authorization,
 * Safe enablement, nonce, expiry, and checker enforcement without broadcasting.
 * State-dependent failures are eligible for one recomputation by runCurveAmoRepeg.
 */
export async function validateRepegPlan(
  provider: ethers.providers.Provider,
  operator: string,
  profile: RepegProfile,
  state: State,
  plan: RepegPlan,
  target: BigNumber,
  trigger: BigNumber
): Promise<"ready" | "skip"> {
  const fresh = await provider.getBlock("latest");
  if (!fresh || fresh.timestamp >= plan.deadline)
    throw new StateChanged("Sizing expired before submission");
  const calls = [
    quoteCall(profile),
    {
      to: state.module,
      value: "0",
      data: encodeRepeg(plan),
      description: "module.repeg",
    },
    quoteCall(profile),
  ];
  const result = await simulate(provider, operator, fresh.number, calls, false);
  if (result[0].status !== "0x1")
    assertCallsSucceeded(result.slice(0, 1), calls.slice(0, 1));
  if (decodeQuote(result[0].returnData).gte(trigger)) return "skip";
  if (result[1].status !== "0x1")
    throw new StateChanged(
      `Module preflight failed: ${decodeRevert(result[1])}`
    );
  if (result[2].status !== "0x1") assertCallsSucceeded(result, calls);
  if (decodeQuote(result[2].returnData).lt(target))
    throw new StateChanged("Pool movement leaves the burn below its target");
  return "ready";
}

/** Runtime dependencies and user parameters for one Talos repegging invocation. */
export interface RepegRunOptions {
  signer: ethers.Signer;
  chainId: number;
  asset: string;
  /** Exact quote-asset amount per one OToken, conventionally "0.9998". */
  sellPrice: string;
  /** Strict execution threshold per one OToken; defaults to "0.9997" and cannot exceed sellPrice. */
  triggerPrice?: string;
  /** Simulates and validates the full request without broadcasting. */
  dryrun: boolean;
  log: Logger;
  resolveAddresses?: (profile: RepegProfile) => Addresses;
}

/**
 * Plans, preflights, and optionally submits one strictly profitable repegging request.
 * @returns The submitted transaction response, or undefined for a no-op or dry run.
 * @throws If profile, deployment, permission, quote, profit, or RPC validation fails,
 * submission fails, or state remains stale after the single allowed recomputation.
 * @remarks Parameters are supplied through RepegRunOptions. This is the broadcast
 * boundary: dry runs perform all checks but send nothing; live runs call the module
 * through the supplied signer. Requests use the observed module nonce and expire
 * 300 seconds after their source block timestamp. Stale calculations are recomputed
 * at most once; an attempted submission is not blindly retried with old calldata.
 * Quotes must remain strictly below triggerPrice initially, after simulated
 * rebase, and at final preflight; sellPrice is the separate post-burn target.
 * Valid prices satisfy 0 < triggerPrice <= sellPrice < 1 in quote-asset units.
 * Receipt confirmation and transaction logging belong to the calling action.
 */
export async function runCurveAmoRepeg({
  signer,
  chainId,
  asset,
  sellPrice,
  triggerPrice = DEFAULT_TRIGGER_PRICE,
  dryrun,
  log,
  resolveAddresses = loadRepegAddresses,
}: RepegRunOptions): Promise<ethers.providers.TransactionResponse | undefined> {
  const profile = getRepegProfile(asset, chainId),
    target = parseSellPrice(sellPrice, profile.quoteDecimals),
    trigger = parseTriggerPrice(triggerPrice, profile.quoteDecimals, target),
    provider = signer.provider;
  if (!provider) throw new Error("Talos signer must have a provider");
  if ((await provider.getNetwork()).chainId !== chainId)
    throw new Error("RPC chain does not match the selected profile");
  const addresses = resolveAddresses(profile),
    operator = await signer.getAddress();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const block = await provider.getBlock("latest");
      if (!block) throw new Error("Latest block unavailable");
      const state = await loadState(
        provider,
        profile,
        addresses,
        operator,
        block.number
      );
      const plan = await buildRepegPlan(
        provider,
        profile,
        state,
        target,
        block,
        trigger
      );
      if (!plan) {
        log.info(
          `${profile.asset}: trigger ${triggerPrice} not breached; target ${sellPrice}; no transaction`
        );
        return;
      }
      log.info(
        `${profile.asset} block ${plan.blockNumber} ${
          plan.blockHash
        }; sell 1 token: ${formatUnits(
          plan.quoteBefore,
          profile.quoteDecimals
        )} -> ${formatUnits(
          plan.quoteAfter,
          profile.quoteDecimals
        )}; trigger ${triggerPrice}; target ${sellPrice}; LP ${formatEther(
          plan.lpTokens
        )}; burn ${formatEther(plan.burn)}`
      );
      log.info(
        `Checker profit ${formatEther(
          plan.values.expectedProfit
        )} +/- ${formatEther(
          plan.values.profitVariance
        )}; vault change ${formatEther(
          plan.values.expectedVaultChange
        )} +/- ${formatEther(plan.values.vaultChangeVariance)}; nonce ${
          plan.nonce
        }; deadline ${plan.deadline}`
      );
      if (
        (await validateRepegPlan(
          provider,
          operator,
          profile,
          state,
          plan,
          target,
          trigger
        )) === "skip"
      ) {
        log.info(
          `Quote recovered to at or above trigger ${triggerPrice} before submission; target ${sellPrice}; no transaction`
        );
        return;
      }
      if (dryrun) {
        log.info(
          "Dry run: exact module simulation passed; no transaction submitted"
        );
        return;
      }
      const module = new Contract(state.module, REPEG_ABI, signer);
      return await module.repeg(...repegArguments(plan));
    } catch (error) {
      if (!(error instanceof StateChanged) || attempt === 1) throw error;
      log.warn(`${error.message}; recomputing once from current chain state`);
    }
  }
  throw new Error("Repegging attempt limit exceeded");
}
