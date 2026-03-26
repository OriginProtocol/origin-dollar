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
 */
const ousdMorphoStrategiesConfig = [
  {
    name: "Ethereum Morpho",
    address: addresses.mainnet.MorphoOUSDv2StrategyProxy,
    metaMorphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault,
    morphoChainId: 1,
    isCrossChain: false,
    isDefault: true,
  },
  {
    name: "Base Morpho",
    address: addresses.mainnet.CrossChainMasterStrategy,
    metaMorphoVaultAddress: addresses.base.MorphoOusdV1Vault,
    morphoChainId: 8453,
    isCrossChain: true,
    isDefault: false,
  },
  {
    name: "HyperEVM Morpho",
    address: addresses.mainnet.CrossChainHyperEVMMasterStrategy,
    metaMorphoVaultAddress: addresses.hyperevm.MorphoOusdV1Vault,
    morphoChainId: 999,
    isCrossChain: true,
    isDefault: false,
  },
];

/**
 * Rebalancing constraints for OUSD.
 */
const ousdConstraints = {
  minDefaultStrategyBps: 2000, // Default strategy always gets ≥ 20% of deployable
  maxPerStrategyBps: 7000, // No single strategy gets > 70%
  minMoveAmount: 5000000000, // $5K in USDC (6 decimals)
  crossChainMinAmount: 25000000000, // $25K in USDC (6 decimals)
  minVaultBalance: 3000000000, // $3K in USDC (6 decimals)
  minApySpread: 0.005, // 0.5% minimum APY spread to trigger rebalancing
  maxApyThreshold: 0.5, // 50% — APY above this is treated as suspicious
  maxApyImpactBps: 50, // Skip deposit if it would drop vault APY by > 0.5%
};

module.exports = { ousdMorphoStrategiesConfig, ousdConstraints };
