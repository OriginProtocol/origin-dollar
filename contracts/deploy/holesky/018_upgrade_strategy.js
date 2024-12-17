const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 018 deployment on Holesky...");

  await upgradeNativeStakingSSVStrategy();

  console.log("Running 018 deployment done");
  return true;
};

mainExport.id = "018_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
