const addresses = require("./addresses");

/**
 * Strategy configuration for OUSD auto-rebalancing.
 * Each entry describes one strategy the rebalancer can move funds to/from.
 */
const ousdStrategiesConfig = [
  {
    name: "Ethereum Morpho",
    address: addresses.mainnet.MorphoOUSDv2StrategyProxy,
    // Morpho V1 vault address for APY lookup (the V2 wrapper is not in Morpho's API)
    morphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault,
    morphoChainId: 1,
    isCrossChain: false,
    isDefault: true,
  },
  {
    name: "Base Morpho",
    address: addresses.mainnet.CrossChainMasterStrategy,
    // Morpho V1 vault on Base for APY lookup
    morphoVaultAddress: "0x581Cc9a73Ec7431723A4a80699B8f801205841F1",
    morphoChainId: 8453,
    isCrossChain: true,
    isDefault: false,
  },
  {
    name: "Curve AMO",
    address: addresses.mainnet.CurveOUSDAMOStrategy,
    morphoVaultAddress: null,
    morphoChainId: null,
    isCrossChain: false,
    isAmo: true,
  },
];

/**
 * Rebalancing constraints for OUSD.
 */
const ousdConstraints = {
  minDefaultStrategyBps: 2000, // Default strategy always gets ≥ 20% of deployable
  maxPerChainBps: 7000, // No single chain gets > 70%
  minMoveAmount: 5000000000, // $5K in USDC (6 decimals)
  crossChainMinAmount: 25000000000, // $25K in USDC (6 decimals)
  minVaultBalance: 3000000000, // $3K in USDC (6 decimals)
  minApySpread: 0.005, // 0.5% minimum APY spread to trigger rebalancing
};

module.exports = { ousdStrategiesConfig, ousdConstraints };
