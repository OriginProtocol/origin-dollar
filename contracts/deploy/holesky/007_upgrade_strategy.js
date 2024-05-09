const {
  upgradeNativeStakingSSVStrategy,
  upgradeNativeStakingFeeAccumulator,
} = require("../deployActions");

const mainExport = async () => {
  console.log("Running 007 deployment on Holesky...");

  console.log("Upgrading native staking fee accumulator");
  await upgradeNativeStakingFeeAccumulator();

  console.log("Upgrading native staking strategy");
  await upgradeNativeStakingSSVStrategy();

  console.log("Running 007 deployment done");
  return true;
};

mainExport.id = "007_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
