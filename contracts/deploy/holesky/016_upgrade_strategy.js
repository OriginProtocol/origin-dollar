const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 016 deployment on Holesky...");

  await upgradeNativeStakingSSVStrategy();

  console.log("Running 016 deployment done");
  return true;
};

mainExport.id = "016_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
