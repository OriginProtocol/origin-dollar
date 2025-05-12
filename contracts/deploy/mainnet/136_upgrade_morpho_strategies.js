const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "136_upgrade_morpho_strategies",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "102952869103112185385289294460650789441590856926098847130687971800657890659280",
  },
  async ({ deployWithConfirmation }) => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const dMorphoSteakhouseUSDCStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );
    const dMorphoGauntletPrimeUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const dMorphoGauntletPrimeUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy new Generalized4626Strategy contract for Morpho Steakhouse USDC
    const dMorphoSteakhouseUSDCStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoSteakhouseUSDCVault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );

    // 2. Deploy new Generalized4626Strategy contract for Morpho Gauntlet Prime USDC
    const dMorphoGauntletPrimeUSDCStrategyImpl = await deployWithConfirmation(
      "Generalized4626Strategy",
      [
        [addresses.mainnet.MorphoGauntletPrimeUSDCVault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );

    // 2. Deploy new Generalized4626Strategy contract for Morpho Gauntlet Prime USDT
    const dMorphoGauntletPrimeUSDTStrategyImpl = await deployWithConfirmation(
      "Generalized4626USDTStrategy",
      [
        [addresses.mainnet.MorphoGauntletPrimeUSDTVault, cVaultProxy.address],
        addresses.mainnet.USDT,
      ]
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Morpho Steakhouse and Gauntlet Prime Strategies",
      actions: [
        {
          // 1. Upgrade Morpho Steakhouse USDC Strategy
          contract: dMorphoSteakhouseUSDCStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoSteakhouseUSDCStrategyImpl.address],
        },
        {
          // 1. Upgrade Morpho Steakhouse USDC Strategy
          contract: dMorphoGauntletPrimeUSDCStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoGauntletPrimeUSDCStrategyImpl.address],
        },
        {
          // 1. Upgrade Morpho Steakhouse USDC Strategy
          contract: dMorphoGauntletPrimeUSDTStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoGauntletPrimeUSDTStrategyImpl.address],
        },
      ],
    };
  }
);
