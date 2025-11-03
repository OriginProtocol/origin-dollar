const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 023 deployment done");
  return true;
};

mainExport.id = "023_upgrade_staking_contract";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
