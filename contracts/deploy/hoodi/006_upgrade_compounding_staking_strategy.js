const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 006 deployment done");
  return true;
};

mainExport.id = "006_upgrade_compounding_staking_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
