const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 010 deployment done");
  return true;
};

mainExport.id = "010_upgrade_compounding_staking_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
