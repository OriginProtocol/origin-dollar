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
  minVaultBalance: 3000000000, // $3K in USDC (6 decimals)
  minApySpread: 0.005, // 0.5% — post-deposit spread check (destination vs source)
  maxApyThreshold: 0.5, // 50% — APY above this is treated as suspicious
  maxApyImpactBps: 50, // Max APY degradation per deposit (0.5%)
  depositStepSize: 100000000000, // $100K USDC — binary search granularity
  maxSpotBelowAvgBps: 200, // Block deposits if spot APY is significantly below the average
  apyAverageWindow: "1h", // Time window for the average APY used in allocation decisions
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
  initSecrets,
  getRpcUrl,
  getProvider,
  getSubsquidUrl,
};
