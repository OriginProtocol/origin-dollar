const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 020 deployment done");
  return true;
};

mainExport.id = "020_upgrade_staking_contract";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
