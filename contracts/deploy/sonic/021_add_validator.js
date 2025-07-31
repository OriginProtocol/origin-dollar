const { deployOnSonic } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses.js");

module.exports = deployOnSonic(
  {
    deployName: "021_add_validator",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    // Staking Strategy
    const cSonicStakingStrategyProxy = await ethers.getContract(
      "SonicStakingStrategyProxy"
    );
    const cSonicStakingStrategy = await ethers.getContractAt(
      "SonicStakingStrategy",
      cSonicStakingStrategyProxy.address
    );

    return {
      name: "Config Sonic Staking Strategy",
      actions: [
        // 1. Add support for new validator
        {
          contract: cSonicStakingStrategy,
          signature: "supportValidator(uint256)",
          args: [45],
        },
        // 2. Remove default strategy for wS
        {
          contract: cOSonicVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.sonic.wS, addresses.zero],
        },
      ],
    };
  }
);
