const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "018_merkl_pool_booster",
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
    // --- Deploy PoolBoosterFactoryMerkl
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterFactoryMerkl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [
        cOSonic.address,
        addresses.sonic.timelock,
        cPoolBoostCentralRegistryProxy.address,
        addresses.sonic.MerklDistributor,
      ]
    );
    const cPoolBoosterMerklFactory = await ethers.getContract(
      "PoolBoosterFactoryMerkl"
    );

    console.log(
      `Pool Booster Merkl Factory deployed to ${cPoolBoosterMerklFactory.address}`
    );

    return {
      name: "Upgrade PoolBoosterCentralRegistry and deploy PoolBoosterFactoryMerkl",
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
          args: [dPoolBoosterFactoryMerkl.address],
        },
      ],
    };
  }
);
