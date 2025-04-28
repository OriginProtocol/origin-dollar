const { deployOnSonic } = require("../../utils/deploy-l2.js");
const { deployWithConfirmation } = require("../../utils/deploy.js");
const addresses = require("../../utils/addresses.js");

module.exports = deployOnSonic(
  {
    deployName: "016_sonic_staking_strategy_upgrade",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    console.log(`Deployer: ${deployerAddr}`);
    console.log(`Strategist: ${strategistAddr}`);

    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

    // Staking Strategy
    const cSonicStakingStrategyProxy = await ethers.getContract(
      "SonicStakingStrategyProxy"
    );
    const dSonicStakingStrategy = await deployWithConfirmation(
      "SonicStakingStrategy",
      [
        [addresses.sonic.SFC, cOSonicVaultProxy.address], // platformAddress, VaultAddress
        addresses.sonic.wS,
        addresses.sonic.SFC,
      ]
    );
    console.log(
      `Deployed Sonic Staking Strategy to ${dSonicStakingStrategy.address}`
    );

    return {
      name: "Upgrade the Sonic Staking Strategy",
      actions: [
        // 1. Upgrade the Sonic Staking Strategy
        {
          contract: cSonicStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dSonicStakingStrategy.address],
        },
      ],
    };
  }
);
