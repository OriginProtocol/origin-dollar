const { ethers, BigNumber } = require("ethers");

const addresses = require("./addresses");
const log = require("./logger")("utils:morpho-apy");

// ─── IRM constants ────────────────────────────────────────────────────────────

const SECONDS_PER_YEAR = 365 * 24 * 3600; // 31_536_000
const WAD = 1e18;
const TARGET_UTIL = 0.9;
const STEEPNESS = 4;

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const morphoBlueAbi = [
  // Returns (totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee)
  "function market(bytes32 id) external view returns (uint128, uint128, uint128, uint128, uint128, uint128)",
  // Returns (supplyShares, borrowShares, collateral)
  "function position(bytes32 id, address user) external view returns (uint256, uint128, uint128)",
  // Returns (loanToken, collateralToken, oracle, irm, lltv)
  "function idToMarketParams(bytes32 id) external view returns (address, address, address, address, uint256)",
];

const irmAbi = [
  "function rateAtTarget(bytes32 id) external view returns (int256)",
];

const metaMorphoAbi = [
  "function supplyQueue(uint256 index) external view returns (bytes32)",
  "function supplyQueueLength() external view returns (uint256)",
  // Returns (cap, enabled, removableAt)
  "function config(bytes32 id) external view returns (uint184, bool, uint64)",
];

const erc20Abi = ["function decimals() external view returns (uint8)"];

// ─── Address helpers ──────────────────────────────────────────────────────────

function _morphoBlueAddress(chainId) {
  const map = {
    1: addresses.mainnet.MorphoBlue,
    8453: addresses.base.MorphoBlue,
    999: addresses.hyperevm.MorphoBlue,
  };
  const addr = map[chainId];
  if (!addr) throw new Error(`No MorphoBlue address for chainId ${chainId}`);
  return addr;
}

// ─── IRM math ─────────────────────────────────────────────────────────────────

/**
 * Compute the Morpho Adaptive Curve IRM speed multiplier.
 * Below target: linear decrease. Above target: steeper linear increase.
 */
function _curve(util) {
  const err = (util - TARGET_UTIL) / TARGET_UTIL;
  if (err < 0) {
    return STEEPNESS * err;
  }
  return (STEEPNESS * (util - TARGET_UTIL)) / (1 - TARGET_UTIL);
}

/**
 * Estimate the supply and borrow APY of a single Morpho Blue market.
 *
 * All numeric inputs are plain JS Numbers in token-unit scale (not WAD).
 * fee and rateAtTarget are raw on-chain values (WAD-scaled integers as numbers).
 *
 * @param {number} depositAmt    - additional deposit to simulate (token units)
 * @param {number} totalSupply   - current total supply assets (token units)
 * @param {number} totalBorrows  - current total borrow assets (token units)
 * @param {number} fee           - protocol fee as a WAD integer (e.g. 0.1e18 = 10%)
 * @param {number} rateAtTarget  - IRM rateAtTarget per second as a WAD integer
 * @returns {{ supplyApy: number, borrowApy: number }}
 */
function estimateMarketApy(
  depositAmt,
  totalSupply,
  totalBorrows,
  fee,
  rateAtTarget
) {
  const supply = totalSupply + depositAmt;
  if (supply <= 0 || rateAtTarget <= 0) return { supplyApy: 0, borrowApy: 0 };

  const util = Math.min(totalBorrows / supply, 0.9999);
  const ratePerSec = rateAtTarget / WAD;
  const borrowRate = ratePerSec * Math.exp(_curve(util));
  const borrowApy = Math.exp(borrowRate * SECONDS_PER_YEAR) - 1;
  const supplyApy = borrowApy * util * (1 - fee / WAD);

  return { supplyApy, borrowApy };
}

// ─── On-chain reads ───────────────────────────────────────────────────────────

/**
 * Fetch all markets in a MetaMorpho vault's supply queue with their current
 * on-chain state and the vault's position in each market.
 *
 * @param {object} provider
 * @param {number} chainId
 * @param {string} vaultAddress
 * @returns {Promise<Array<{
 *   marketId: string,
 *   cap: BigNumber,
 *   vaultSupplyAssets: BigNumber,
 *   totalSupplyAssets: BigNumber,
 *   totalBorrowAssets: BigNumber,
 *   fee: BigNumber,
 *   rateAtTarget: BigNumber,
 *   decimals: number
 * }>>}
 */
async function fetchVaultMarkets(provider, chainId, vaultAddress) {
  const vault = new ethers.Contract(vaultAddress, metaMorphoAbi, provider);
  const morpho = new ethers.Contract(
    _morphoBlueAddress(chainId),
    morphoBlueAbi,
    provider
  );

  const queueLen = await vault.supplyQueueLength();
  const len = queueLen.toNumber();
  if (len === 0) return [];

  const marketIds = await Promise.all(
    Array.from({ length: len }, (_, i) => vault.supplyQueue(i))
  );

  const markets = await Promise.all(
    marketIds.map(async (marketId) => {
      const [config, position, marketState, params] = await Promise.all([
        vault.config(marketId),
        morpho.position(marketId, vaultAddress),
        morpho.market(marketId),
        morpho.idToMarketParams(marketId),
      ]);

      const cap = BigNumber.from(config[0]);
      const loanToken = params[0];
      const marketIrm = params[3];

      // Vault's supply position, derived from shares
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

      // Read rateAtTarget from the market's own IRM (each market can use a
      // different IRM — do not rely on a hardcoded address).
      let rateAtTarget = BigNumber.from(0);
      if (marketIrm !== ethers.constants.AddressZero) {
        const irmContract = new ethers.Contract(marketIrm, irmAbi, provider);
        rateAtTarget = BigNumber.from(await irmContract.rateAtTarget(marketId));
      }

      const erc20 = new ethers.Contract(loanToken, erc20Abi, provider);
      const decimals = await erc20.decimals();

      log(
        `  market ${marketId.slice(0, 10)}… ` +
          `supply=${totalSupplyAssets} borrow=${totalBorrowAssets} ` +
          `fee=${fee} rate=${rateAtTarget} ` +
          `vaultAlloc=${vaultSupplyAssets} cap=${cap}`
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

// ─── APY helpers ──────────────────────────────────────────────────────────────

/**
 * Compute weighted supply APY across a set of markets.
 *
 * Weight = vaultSupplyAssets when any market has a non-zero vault position.
 * Fallback to totalSupplyAssets when all vaultSupplyAssets are zero (e.g. a V1
 * vault whose funds migrated to a V2 wrapper — supply queue is valid but the
 * vault itself holds no shares).
 *
 * @param {Array}  markets          - from fetchVaultMarkets
 * @param {object} depositSim       - optional { [marketId]: BigNumber addedSupply }
 */
function _weightedApy(markets, depositSim = {}) {
  const suspiciousMarkets = markets.filter(
    (m) => m.rateAtTarget.isZero() && m.totalBorrowAssets.gt(0)
  );
  if (suspiciousMarkets.length > 0) {
    log(
      `WARNING: ${suspiciousMarkets.length} market(s) have active borrows but ` +
        `rateAtTarget=0 — IRM may not implement rateAtTarget(). ` +
        `Market IDs: ${suspiciousMarkets
          .map((m) => m.marketId.slice(0, 10))
          .join(", ")}`
    );
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of markets) {
    const scale = Math.pow(10, m.decimals);
    const simSupplyBn = depositSim[m.marketId]
      ? m.totalSupplyAssets.add(depositSim[m.marketId])
      : m.totalSupplyAssets;

    const supply = Number(simSupplyBn.toString()) / scale;
    const borrows = Number(m.totalBorrowAssets.toString()) / scale;
    const fee = Number(m.fee.toString());
    const rate = Number(m.rateAtTarget.toString());

    const { supplyApy } = estimateMarketApy(0, supply, borrows, fee, rate);

    const weight = Number(m.vaultSupplyAssets.toString()) / scale;

    if (weight <= 0) continue;

    log(
      `  market ${m.marketId.slice(0, 10)}… ` +
        `util=${supply > 0 ? ((borrows / supply) * 100).toFixed(1) : 0}% ` +
        `supplyAPY=${(supplyApy * 100).toFixed(2)}% ` +
        `weight=${weight.toFixed(2)}`
    );

    weightedSum += supplyApy * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    throw new Error(
      `Vault has ${markets.length} market(s) in its supply queue but zero ` +
        `supply position in all of them. Check that the vault address passed ` +
        `to fetchVaultMarkets is the MetaMorpho V1 vault, not a VaultV2 wrapper.`
    );
  }

  return weightedSum / totalWeight;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Estimate the current weighted supply APY of a MetaMorpho vault by reading
 * market state and IRM rates directly from chain.
 *
 * @param {object} provider
 * @param {number} chainId        - 1, 8453, or 999
 * @param {string} vaultAddress
 * @returns {Promise<number>} APY as a decimal (0.035 = 3.5%)
 */
async function estimateVaultApy(provider, chainId, vaultAddress) {
  log(`estimateVaultApy called: chain=${chainId} vault=${vaultAddress}`);
  const markets = await fetchVaultMarkets(provider, chainId, vaultAddress);

  if (markets.length === 0) {
    log(`  no markets in supply queue — returning 0`);
    return 0;
  }

  log(`  supplyQueueLength=${markets.length} for vault ${vaultAddress}`);
  const apy = _weightedApy(markets);
  log(`  vault APY = ${(apy * 100).toFixed(2)}%`);
  return apy;
}

/**
 * Simulate depositing `depositAmount` into a MetaMorpho vault and measure the
 * resulting APY impact. The vault fills markets in supply-queue order up to each cap.
 *
 * @param {object}    provider
 * @param {number}    chainId
 * @param {string}    vaultAddress
 * @param {BigNumber} depositAmount - in the loan token's native decimals (USDC = 6)
 * @returns {Promise<{ currentApy: number, newApy: number, impactBps: number }>}
 */
async function estimateDepositImpact(
  provider,
  chainId,
  vaultAddress,
  depositAmount
) {
  const markets = await fetchVaultMarkets(provider, chainId, vaultAddress);
  const currentApy = _weightedApy(markets);

  // Simulate deposit flowing through supply queue in order, filling up to cap
  const sim = {}; // marketId → BigNumber increase in totalSupplyAssets
  let remaining = depositAmount;

  for (const m of markets) {
    if (remaining.isZero()) break;
    const available = m.cap.gt(m.vaultSupplyAssets)
      ? m.cap.sub(m.vaultSupplyAssets)
      : BigNumber.from(0);
    if (available.isZero()) continue;

    const fill = remaining.lt(available) ? remaining : available;
    sim[m.marketId] = fill;
    remaining = remaining.sub(fill);
  }

  const newApy = _weightedApy(markets, sim);
  const impactBps = Math.round((currentApy - newApy) * 10000);

  log(
    `estimateDepositImpact: deposit=${depositAmount} ` +
      `currentAPY=${(currentApy * 100).toFixed(2)}% ` +
      `newAPY=${(newApy * 100).toFixed(2)}% ` +
      `impact=${impactBps}bps`
  );

  return { currentApy, newApy, impactBps };
}

module.exports = { estimateVaultApy, estimateDepositImpact, estimateMarketApy };
