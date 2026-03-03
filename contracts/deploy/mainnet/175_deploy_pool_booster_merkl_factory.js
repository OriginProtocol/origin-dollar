const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy");
const {
  isFork,
  isMainnet,
  isSmokeTest,
  isForkTest,
} = require("../../test/helpers");
const { hardhatSetBalance } = require("../../test/_fund");

const deployName = "175_deploy_pool_booster_merkl_factory";

const main = async () => {
  console.log(`Running ${deployName} deployment...`);

  const { deployerAddr } = await getNamedAccounts();
  if (isFork) {
    await hardhatSetBalance(deployerAddr, "1000000");
  }

  const cPoolBoostCentralRegistryProxy = await ethers.getContract(
    "PoolBoostCentralRegistryProxy"
  );
  const oethProxy = await ethers.getContract("OETHProxy");

  // ---------------------------------------------------------------------------------------------------------
  // --- 1. Deploy PoolBoosterMerklV2 (implementation for beacon proxies)
  // ---------------------------------------------------------------------------------------------------------
  const dPoolBoosterMerklV2 = await deployWithConfirmation(
    "PoolBoosterMerklV2",
    []
  );
  console.log(`PoolBoosterMerklV2 deployed to ${dPoolBoosterMerklV2.address}`);

  // ---------------------------------------------------------------------------------------------------------
  // --- 2. Deploy UpgradeableBeacon pointing to PoolBoosterMerklV2
  // ---------------------------------------------------------------------------------------------------------
  const dUpgradeableBeacon = await deployWithConfirmation("UpgradeableBeacon", [
    dPoolBoosterMerklV2.address,
  ]);
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
  const dFactory = await deployWithConfirmation("PoolBoosterFactoryMerkl", [
    oethProxy.address,
    addresses.multichainStrategist,
    cPoolBoostCentralRegistryProxy.address,
    dUpgradeableBeacon.address,
  ]);
  console.log(`PoolBoosterFactoryMerkl deployed to ${dFactory.address}`);

  // NOTE: Registry approveFactory/removeFactory must be called by the
  // multichain strategist safe (registry governance was transferred in script 176).

  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;

if (isFork) {
  const networkName = isForkTest ? "hardhat" : "localhost";
  const migrations = require(`../../deployments/${networkName}/.migrations.json`);
  main.skip = () => Boolean(migrations[deployName]);
} else {
  main.skip = () => !isMainnet || isSmokeTest;
}

module.exports = main;
