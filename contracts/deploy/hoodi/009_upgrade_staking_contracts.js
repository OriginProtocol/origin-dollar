const {
  upgradeNativeStakingSSVStrategy,
  upgradeCompoundingStakingSSVStrategy,
} = require("../deployActions");

const mainExport = async () => {
  console.log("Running 009_upgrade_staking_contract deployment on Hoodi...");

  await upgradeNativeStakingSSVStrategy();

  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 009 deployment done");
  return true;
};

mainExport.id = "009_upgrade_staking_contract";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
