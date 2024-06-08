const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 014 deployment on Holesky...");

  await upgradeNativeStakingSSVStrategy();

  console.log("Running 014 deployment done");
  return true;
};

mainExport.id = "014_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
