const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy.js");

// 0x03A9896A464C515d13f2679df337bF95bc891fdA: Voter
// 0xd9db92613867FE0d290CE64Fe737E2F8B80CADc3: Rewarder Factory
// 0x161A72027D83DA46329ed64A4EDfd0B717b7f8a7: Rewarder Implem
module.exports = deployOnSonic(
  {
    deployName: "017_pool_booster_metropolis",
  },
  async ({ ethers }) => {
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Upgrade PoolBoosterCentralRegistry
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );
    console.log(
      `Deployed new Pool Boost Central Registry to ${dPoolBoosterCentralRegistry.address}`
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterFactoryMetropolis
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterFactoryMetropolis = await deployWithConfirmation(
      "PoolBoosterFactoryMetropolis",
      [
        cOSonic.address,
        addresses.sonic.timelock,
        cPoolBoostCentralRegistryProxy.address,
        addresses.sonic.Metropolis.RewarderFactory, // Rewarder Factory
        addresses.sonic.Metropolis.Voter, // Voter
      ]
    );
    console.log(
      `Pool Booster Factory Metropolis deployed to ${dPoolBoosterFactoryMetropolis.address}`
    );

    return {
      name: "Upgrade PoolBoosterCentralRegistry and deploy PoolBoosterFactoryMetropolis",
      actions: [
        {
          contract: cPoolBoostCentralRegistryProxy,
          signature: "upgradeTo(address)",
          args: [dPoolBoosterCentralRegistry.address],
        },
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactoryMetropolis.address],
        },
      ],
    };
  }
);
