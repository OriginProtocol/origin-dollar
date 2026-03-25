const { ethers, BigNumber } = require("ethers");

const addresses = require("./addresses");
const log = require("./logger")("utils:morpho-apy");

// ─── Constants (Adaptive Curve IRM) ──────────────────────────────────────────

const SECONDS_PER_YEAR = 31_536_000;
const WAD = 1e18;
const TARGET_UTILIZATION = 0.9;
const CURVE_STEEPNESS = 4;

// ─── Minimal ABIs ────────────────────────────────────────────────────────────

const morphoBlueAbi = [
  // market(bytes32) → (totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee)
  "function market(bytes32 id) external view returns (uint128, uint128, uint128, uint128, uint128, uint128)",
  // position(bytes32, address) → (supplyShares, borrowShares, collateral)
  "function position(bytes32 id, address user) external view returns (uint256, uint128, uint128)",
  // idToMarketParams(bytes32) → (loanToken, collateralToken, oracle, irm, lltv)
  "function idToMarketParams(bytes32 id) external view returns (address, address, address, address, uint256)",
];

const irmAbi = [
  "function rateAtTarget(bytes32 id) external view returns (int256)",
];

const metaMorphoAbi = [
  "function supplyQueue(uint256 index) external view returns (bytes32)",
  "function supplyQueueLength() external view returns (uint256)",
  // config(bytes32) → (cap, enabled, removableAt)
  "function config(bytes32 id) external view returns (uint184, bool, uint64)",
];

const erc20Abi = ["function decimals() external view returns (uint8)"];

// ─── Address helpers ─────────────────────────────────────────────────────────

function _morphoBlueAddress(chainId) {
  if (chainId === 1) return addresses.mainnet.MorphoBlue;
  if (chainId === 8453) return addresses.base.MorphoBlue;
  throw new Error(`No MorphoBlue address for chainId ${chainId}`);
}

// ─── Pure IRM math (ported from Python gist) ─────────────────────────────────
//
// All math uses Number (64-bit double), identical to Python's float.
// On-chain BigNumber values are normalized to whole-token units at the boundary
// so utilization ratios are safe regardless of token decimals.

/**
 * Distance from target utilization, normalized to [-1, 1].
 * @param {number} util - Utilization ratio in [0, 1]
 */
function calculateError(util) {
  if (util > TARGET_UTILIZATION) {
    return (util - TARGET_UTILIZATION) / (1 - TARGET_UTILIZATION);
  }
  return (util - TARGET_UTILIZATION) / TARGET_UTILIZATION;
}

/**
 * IRM rate multiplier at a given utilization.
 * Below target: linear from 1/STEEPNESS to 1.
 * Above target: linear from 1 to STEEPNESS.
 * @param {number} util - Utilization ratio in [0, 1]
 */
function calculateCurve(util) {
  const error = calculateError(util);
  if (util <= TARGET_UTILIZATION) {
    return (1 - 1 / CURVE_STEEPNESS) * error + 1;
  }
  return (CURVE_STEEPNESS - 1) * error + 1;
}

/**
 * Estimate borrow and supply APY for a single Morpho market.
 *
 * All amounts are in normalized (whole-token) units — the caller divides
 * raw on-chain values by 10^decimals before passing them here.
 *
 * @param {number} depositAmount   Whole-token amount to add to supply (0 for current state)
 * @param {number} totalSupply     Current total supply (whole tokens)
 * @param {number} totalBorrows    Current total borrows (whole tokens)
 * @param {number} fee             Fee in WAD (raw Number from on-chain)
 * @param {number} rateAtTarget    On-chain rateAtTarget (WAD, per-second)
 * @returns {{ borrowApy: number, supplyApy: number }}
 */
function estimateMarketApy(
  depositAmount,
  totalSupply,
  totalBorrows,
  fee,
  rateAtTarget
) {
  const newSupply = totalSupply + depositAmount;
  if (newSupply <= 0) return { borrowApy: 0, supplyApy: 0 };

  let utilization = totalBorrows / newSupply;
  utilization = Math.min(utilization, 0.9999);
  if (utilization < 0.0001) utilization = 0;

  const ratePerSecond = rateAtTarget / WAD;
  const curve = calculateCurve(utilization);
  const borrowRate = ratePerSecond * curve;
  let borrowApy = Math.exp(borrowRate * SECONDS_PER_YEAR) - 1;

  const feePct = fee ? fee / WAD : 0;
  let supplyApy = borrowApy * utilization * (1 - feePct);

  // Clamp to sane range
  borrowApy = Math.max(0, Math.min(borrowApy, 8));
  supplyApy = Math.max(0, Math.min(supplyApy, 8));

  return { borrowApy, supplyApy };
}

// ─── On-chain reading ────────────────────────────────────────────────────────

/**
 * Fetch the vault's supply queue markets with their on-chain data.
 *
 * For each market in the vault's supplyQueue, reads:
 * - The vault's supply position (supplyShares → supplyAssets via totalSupply/totalShares)
 * - The market's total supply/borrow/fee
 * - The IRM's rateAtTarget (read from the market's own IRM, not a hardcoded address)
 * - The vault's cap for that market
 *
 * @param {object} provider
 * @param {number} chainId
 * @param {string} vaultAddress  MetaMorpho vault address
 * @returns {Promise<Array<{
 *   marketId: string, cap: BigNumber, vaultSupplyAssets: BigNumber,
 *   totalSupplyAssets: BigNumber, totalBorrowAssets: BigNumber,
 *   fee: BigNumber, rateAtTarget: BigNumber, decimals: number
 * }>>}
 */
async function fetchVaultMarkets(provider, chainId, vaultAddress) {
  const vault = new ethers.Contract(vaultAddress, metaMorphoAbi, provider);
  const morpho = new ethers.Contract(
    _morphoBlueAddress(chainId),
    morphoBlueAbi,
    provider
  );

  // Get supply queue length, then read all market IDs
  const queueLength = await vault.supplyQueueLength();
  const len = queueLength.toNumber();
  console.log(
    `[morpho-apy] supplyQueueLength=${len} for vault ${vaultAddress}`
  );

  if (len === 0) return [];

  // Read all market IDs in the supply queue
  const marketIds = await Promise.all(
    Array.from({ length: len }, (_, i) => vault.supplyQueue(i))
  );

  // For each market, fetch data in parallel
  const markets = await Promise.all(
    marketIds.map(async (marketId) => {
      // First fetch: config, position, market state, and market params
      const [config, position, marketState, params] = await Promise.all([
        vault.config(marketId),
        morpho.position(marketId, vaultAddress),
        morpho.market(marketId),
        morpho.idToMarketParams(marketId),
      ]);

      const cap = BigNumber.from(config[0]);
      const loanToken = params[0];
      const marketIrm = params[3]; // IRM address for this specific market

      // Compute vault's supply assets from its supply shares
      // supplyAssets = supplyShares * totalSupplyAssets / totalSupplyShares
      const vaultSupplyShares = BigNumber.from(position[0]);
      const totalSupplyAssets = BigNumber.from(marketState[0]);
      const totalSupplyShares = BigNumber.from(marketState[1]);
      const totalBorrowAssets = BigNumber.from(marketState[2]);
      const fee = BigNumber.from(marketState[5]);

      let vaultSupplyAssets = BigNumber.from(0);
      if (!totalSupplyShares.isZero()) {
        vaultSupplyAssets = vaultSupplyShares
          .mul(totalSupplyAssets)
          .div(totalSupplyShares);
      }

      // Fetch rateAtTarget from the market's own IRM (not a hardcoded address)
      let rateAtTarget = BigNumber.from(0);
      if (marketIrm !== ethers.constants.AddressZero) {
        try {
          const marketIrmContract = new ethers.Contract(
            marketIrm,
            irmAbi,
            provider
          );
          rateAtTarget = BigNumber.from(
            await marketIrmContract.rateAtTarget(marketId)
          );
        } catch (err) {
          console.error(
            `[morpho-apy] rateAtTarget failed for market ${marketId} ` +
              `(IRM: ${marketIrm}): ${err.message}`
          );
        }
      }

      const erc20 = new ethers.Contract(loanToken, erc20Abi, provider);
      const decimals = await erc20.decimals();

      console.log(
        `[morpho-apy]   Market ${marketId.slice(0, 10)}… ` +
          `supply=${totalSupplyAssets} borrow=${totalBorrowAssets} ` +
          `fee=${fee} rate=${rateAtTarget} ` +
          `vaultAlloc=${vaultSupplyAssets}`
      );

      return {
        marketId,
        cap,
        vaultSupplyAssets,
        totalSupplyAssets,
        totalBorrowAssets,
        fee,
        rateAtTarget,
        decimals,
      };
    })
  );

  return markets;
}

/**
 * Compute the current weighted supply APY of a MetaMorpho vault.
 *
 * Vault APY = Σ(marketSupplyAPY_i × weight_i) / Σ(weight_i)
 *
 * Weight is the vault's allocation in each market when available.
 * For V1 vaults with 0 allocation (funds migrated to V2), falls back to
 * total market supply as weight — the market-level APY is still valid for
 * any depositor.
 *
 * @param {object} provider
 * @param {number} chainId
 * @param {string} vaultAddress
 * @returns {Promise<number>} APY as a decimal (0.05 = 5%)
 */
async function estimateVaultApy(provider, chainId, vaultAddress) {
  console.log(
    `[morpho-apy] estimateVaultApy called: chain=${chainId} vault=${vaultAddress}`
  );
  const markets = await fetchVaultMarkets(provider, chainId, vaultAddress);

  if (markets.length === 0) {
    log(`  No markets in supply queue — returning 0`);
    return 0;
  }

  let weightedApy = 0;
  let totalWeight = 0;

  for (const m of markets) {
    const scale = Math.pow(10, m.decimals);
    const supply = Number(m.totalSupplyAssets.toString()) / scale;
    const borrows = Number(m.totalBorrowAssets.toString()) / scale;
    const fee = Number(m.fee.toString());
    const rate = Number(m.rateAtTarget.toString());

    if (supply <= 0) continue;

    const { supplyApy, borrowApy } = estimateMarketApy(
      0,
      supply,
      borrows,
      fee,
      rate
    );

    // Weight by vault allocation if available, otherwise by total market supply.
    // V1 vaults may have 0 allocation (funds migrated to V2) but the market-level
    // APY is still valid for any depositor.
    const vaultAlloc = Number(m.vaultSupplyAssets.toString()) / scale;
    const weight = vaultAlloc > 0 ? vaultAlloc : supply;

    console.log(
      `[morpho-apy]   Market ${m.marketId.slice(0, 10)}… ` +
        `util=${((borrows / supply) * 100).toFixed(1)}% ` +
        `supplyAPY=${(supplyApy * 100).toFixed(2)}% ` +
        `borrowAPY=${(borrowApy * 100).toFixed(2)}% ` +
        `weight=${weight.toFixed(2)}${
          vaultAlloc > 0 ? " (vault)" : " (market)"
        }`
    );
    weightedApy += supplyApy * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 0;
  const vaultApy = weightedApy / totalWeight;
  console.log(
    `[morpho-apy] Vault APY = ${(vaultApy * 100).toFixed(4)}% ` +
      `(${markets.length} markets, ${totalWeight.toFixed(2)} total weight)`
  );
  return vaultApy;
}

/**
 * Estimate the vault APY after a hypothetical deposit, and the impact in bps.
 *
 * MetaMorpho fills markets in supplyQueue order up to each market's cap.
 * This simulates that flow: the deposit is distributed across markets in queue
 * order, adding to each market's supply until the cap is hit, then moving on.
 *
 * @param {object}    provider
 * @param {number}    chainId
 * @param {string}    vaultAddress
 * @param {BigNumber} depositAmount  Raw asset amount (e.g. USDC with 6 decimals)
 * @returns {Promise<{ currentApy: number, newApy: number, impactBps: number }>}
 */
async function estimateDepositImpact(
  provider,
  chainId,
  vaultAddress,
  depositAmount
) {
  const markets = await fetchVaultMarkets(provider, chainId, vaultAddress);
  if (markets.length === 0) {
    return { currentApy: 0, newApy: 0, impactBps: 0 };
  }

  // Use first market's decimals (all markets in a vault share the same loan token)
  const scale = Math.pow(10, markets[0].decimals);
  let remaining = Number(depositAmount.toString()) / scale;

  let currentWeighted = 0;
  let newWeighted = 0;
  let totalWeight = 0;

  for (const m of markets) {
    const mScale = Math.pow(10, m.decimals);
    const supply = Number(m.totalSupplyAssets.toString()) / mScale;
    const borrows = Number(m.totalBorrowAssets.toString()) / mScale;
    const fee = Number(m.fee.toString());
    const rate = Number(m.rateAtTarget.toString());
    const vaultAlloc = Number(m.vaultSupplyAssets.toString()) / mScale;
    const cap = Number(m.cap.toString()) / mScale;
    const weight = vaultAlloc > 0 ? vaultAlloc : supply;

    if (supply <= 0) continue;

    // Current APY for this market
    const { supplyApy: currentApy } = estimateMarketApy(
      0,
      supply,
      borrows,
      fee,
      rate
    );
    currentWeighted += currentApy * weight;

    // How much of the deposit goes into this market?
    const headroom = Math.max(0, cap - supply);
    const depositHere = Math.min(remaining, headroom);
    remaining -= depositHere;

    // New APY after deposit
    const { supplyApy: newApy } = estimateMarketApy(
      depositHere,
      supply,
      borrows,
      fee,
      rate
    );
    const newWeight = weight + depositHere;
    newWeighted += newApy * newWeight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return { currentApy: 0, newApy: 0, impactBps: 0 };
  }

  const currentApy = currentWeighted / totalWeight;
  const newTotalWeight = totalWeight + Number(depositAmount.toString()) / scale;
  const newApy = newWeighted / newTotalWeight;
  const impactBps = Math.round((currentApy - newApy) * 10000);

  log(
    `Deposit impact: ${(currentApy * 100).toFixed(2)}% → ${(
      newApy * 100
    ).toFixed(2)}% (${impactBps}bps)`
  );

  return { currentApy, newApy, impactBps };
}

module.exports = {
  estimateMarketApy,
  estimateVaultApy,
  estimateDepositImpact,
  // Expose for unit testing
  calculateError,
  calculateCurve,
};
