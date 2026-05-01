const { ethers } = require("ethers");

const addresses = require("./addresses");

/**
 * Morpho strategy configuration for OUSD auto-rebalancing.
 * Each entry describes one Morpho strategy the rebalancer can move funds to/from.
 *
 * Fields:
 *   name                  – Human-readable label
 *   address               – Strategy proxy address (on mainnet)
 *   metaMorphoVaultAddress – The inner MetaMorpho V1.1 vault (has supplyQueueLength).
 *                           All OUSD vaults are VaultV2; this is the inner vault that
 *                           VaultV2 delegates to. Find it with:
 *                             VaultV2(outerVaultAddr).adapters(0)  → adapterAddr
 *                             Adapter(adapterAddr).morphoVaultV1() → metaMorphoVaultAddress
 *   morphoChainId         – Chain where that vault lives (1 = Ethereum, 8453 = Base, 999 = HyperEVM)
 *   isCrossChain          – True for strategies that bridge via CCTP
 *   isDefault             – Fallback strategy; exactly one entry must have this set
 *   minAllocationBps      – Minimum allocation in basis points (e.g. 500 = 5%)
 *   maxAllocationBps      – Maximum allocation in basis points (e.g. 9500 = 95%)
 */
const ousdMorphoStrategiesConfig = [
  {
    name: "Ethereum Morpho",
    address: addresses.mainnet.MorphoOUSDv2StrategyProxy,
    metaMorphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault,
    morphoChainId: 1,
    isCrossChain: false,
    isDefault: true,
    minAllocationBps: 500, // ≥5%
    maxAllocationBps: 10000, // 100% — default strategy can hold everything
  },
  {
    name: "Base Morpho",
    address: addresses.mainnet.CrossChainMasterStrategy,
    metaMorphoVaultAddress: addresses.base.MorphoOusdV1Vault,
    morphoChainId: 8453,
    isCrossChain: true,
    isDefault: false,
    minAllocationBps: 0,
    maxAllocationBps: 9500, // ≤95%
  },
  {
    name: "HyperEVM Morpho",
    address: addresses.mainnet.CrossChainHyperEVMMasterStrategy,
    metaMorphoVaultAddress: addresses.hyperevm.MorphoOusdV1Vault,
    morphoChainId: 999,
    isCrossChain: true,
    isDefault: false,
    minAllocationBps: 0,
    maxAllocationBps: 9500, // ≤95%
  },
];

/**
 * Rebalancing constraints for OUSD.
 */
const ousdConstraints = {
  minMoveAmount: 5000000000, // $5K in USDC (6 decimals)
  crossChainMinAmount: 25000000000, // $25K in USDC (6 decimals)
  minVaultBalance: 0, // no minimum vault reserve
  minApySpread: 0.005, // 0.5% — post-deposit spread check (destination vs source)
  maxApyThreshold: 0.5, // 50% — APY above this is treated as suspicious
  maxApyImpactBps: 50, // Max APY degradation per deposit (0.5%)
  maxWithdrawalApyImpactBps: 50, // Max APY increase on source per withdrawal (0.5%)
  depositStepSize: 100000000000, // $100K USDC — binary search granularity
  withdrawalStepSize: 100000000000, // $100K USDC — binary search granularity
  maxSpotBelowAvgBps: 200, // Block deposits if spot APY is significantly below the average
  apyAverageWindow: "1h", // Time window for the average APY used in allocation decisions
  allocationChunkSize: 50000000000, // $50K USDC — step-wise allocation granularity
};

// ─── Morpho market IDs ──────────────────────────────────────────────────────
const OETH_USDC_MARKET_ID =
  "0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e";
const WSTETH_USDC_MARKET_ID =
  "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc";

// ─── Ethereum Morpho vault withdrawal constraints ────────────────────────────
const ethMorphoConstraints = {
  maxOethUtilization: 0.9, // OETH/USDC utilization must stay under 90%
  minOethWstethSpread: 0.005, // OETH/USDC supply rate ≥ 0.5% above wstETH/USDC
};

// ─── Secrets / RPC config ────────────────────────────────────────────────────
// Defender Actions call initSecrets(event.secrets) once at startup.
// Hardhat tasks fall through to process.env (loaded from .env by hardhat config).

let _secrets = {};

function initSecrets(secrets) {
  _secrets = secrets || {};
}

const _rpcEnvVars = {
  1: "PROVIDER_URL",
  8453: "BASE_PROVIDER_URL",
  999: "HYPEREVM_PROVIDER_URL",
};

function getRpcUrl(chainId) {
  const envVar = _rpcEnvVars[chainId];
  return _secrets[envVar] || process.env[envVar];
}

function getProvider(chainId) {
  const url = getRpcUrl(chainId);
  return url ? new ethers.providers.JsonRpcProvider(url) : null;
}

function getSubsquidUrl() {
  return (
    _secrets.ORIGIN_SUBSQUID_SERVER ||
    process.env.ORIGIN_SUBSQUID_SERVER ||
    "https://origin.squids.live/origin-squid:prod/api/graphql"
  );
}

module.exports = {
  ousdMorphoStrategiesConfig,
  ousdConstraints,
  OETH_USDC_MARKET_ID,
  WSTETH_USDC_MARKET_ID,
  ethMorphoConstraints,
  initSecrets,
  getRpcUrl,
  getProvider,
  getSubsquidUrl,
};
