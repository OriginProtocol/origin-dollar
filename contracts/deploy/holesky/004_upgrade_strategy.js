const {
  upgradeNativeStakingSSVStrategy,
  upgradeOETHHarvester,
} = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");

const mainExport = async () => {
  console.log("Running 004 deployment on Holesky...");

  console.log("Upgrading native staking strategy");
  await upgradeNativeStakingSSVStrategy();

  console.log("deploying harvester");
  const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
  const cOETHHarvester = await upgradeOETHHarvester(cOETHDripperProxy.address);

  const strategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const cStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    strategyProxy.address
  );

  console.log("configuring harvester and the strategy");
  await withConfirmation(
    cOETHHarvester.setSupportedStrategy(strategyProxy.address, true)
  );

  await withConfirmation(cStrategy.setHarvesterAddress(cOETHHarvester.address));

  console.log("Running 004 deployment done");
  return true;
};

mainExport.id = "004_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
