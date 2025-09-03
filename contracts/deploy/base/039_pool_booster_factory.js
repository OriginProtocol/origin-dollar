const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");

module.exports = deployOnBase(
  {
    deployName: "039_pool_booster_factory",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Fetch contracts
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");

    // 2. Deploy PoolBooster Central Registry (proxy + implementation)
    await deployWithConfirmation("PoolBoostCentralRegistryProxy", []);
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    console.log(
      `Pool boost central registry proxy deployed: ${cPoolBoostCentralRegistryProxy.address}`
    );

    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );
    console.log(
      `Deployed Pool Boost Central Registry to ${dPoolBoostCentralRegistry.address}`
    );
    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // prettier-ignore
    await withConfirmation(
      cPoolBoostCentralRegistryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoostCentralRegistry.address,
          addresses.base.timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    // 3. Deploy PoolBoosterFactory for Merkl
    const dPoolBoosterFactory = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl_v1",
      [
        cOETHbProxy.address,
        addresses.base.multichainStrategist,
        cPoolBoostCentralRegistryProxy.address,
        addresses.base.MerklDistributor,
      ],
      "PoolBoosterFactoryMerkl"
    );
    console.log(
      `Pool Booster Merkl Factory deployed to ${dPoolBoosterFactory.address}`
    );

    return {
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactory.address],
        },
      ],
    };
  }
);
