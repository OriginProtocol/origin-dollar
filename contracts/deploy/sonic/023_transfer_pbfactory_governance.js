const { deployOnSonic } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "023_transfer_pbfactory_governance",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    const factories = await cPoolBoostCentralRegistry.getAllFactories();

    const actions = [];
    for (const factory of factories) {
      actions.push({
        contract: await ethers.getContractAt(
          "AbstractPoolBoosterFactory",
          factory
        ),
        signature: "transferGovernance(address)",
        args: [addresses.multichainStrategist],
      });
    }
    actions.push({
      contract: cPoolBoostCentralRegistry,
      signature: "transferGovernance(address)",
      args: [addresses.multichainStrategist],
    });

    return {
      name: "Transfer PoolBoost Registry/Factories governance",
      actions,
    };
  }
);
