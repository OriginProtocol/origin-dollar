const { deployOnBaseWithEOA } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithEOA(
  {
    deployName: "045_deploy_pool_booster_merkl_factory",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();

    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    const oethBaseProxy = await ethers.getContract("OETHBaseProxy");

    // ---------------------------------------------------------------------------------------------------------
    // --- 1. Deploy PoolBoosterMerklV2 (implementation for beacon proxies)
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterMerklV2 = await deployWithConfirmation(
      "PoolBoosterMerklV2",
      []
    );
    console.log(
      `PoolBoosterMerklV2 deployed to ${dPoolBoosterMerklV2.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- 2. Deploy UpgradeableBeacon pointing to PoolBoosterMerklV2
    // ---------------------------------------------------------------------------------------------------------
    const dUpgradeableBeacon = await deployWithConfirmation(
      "UpgradeableBeacon",
      [dPoolBoosterMerklV2.address]
    );
    // Transfer beacon ownership from deployer to multichainStrategist
    const cBeacon = await ethers.getContractAt(
      "UpgradeableBeacon",
      dUpgradeableBeacon.address
    );
    const sDeployer = ethers.provider.getSigner(deployerAddr);
    await cBeacon
      .connect(sDeployer)
      .transferOwnership(addresses.multichainStrategist);
    console.log(`UpgradeableBeacon deployed to ${dUpgradeableBeacon.address}`);

    // ---------------------------------------------------------------------------------------------------------
    // --- 3. Deploy PoolBoosterFactoryMerkl
    // ---------------------------------------------------------------------------------------------------------
    const dFactory = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [
        oethBaseProxy.address,
        addresses.multichainStrategist,
        cPoolBoostCentralRegistryProxy.address,
        dUpgradeableBeacon.address,
      ],
      "PoolBoosterFactoryMerkl",
      true
    );
    console.log(`PoolBoosterFactoryMerkl deployed to ${dFactory.address}`);

    // NOTE: Registry approveFactory/removeFactory must be called by the
    // multichain strategist safe (registry governance was transferred).
  }
);
