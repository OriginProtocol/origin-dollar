const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 013 deployment on Holesky...");

  console.log("Upgrading native staking strategy");
  await upgradeNativeStakingSSVStrategy();

  console.log("Running 013 deployment done");
  return true;
};

mainExport.id = "013_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
