const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log("Running 019 deployment on Holesky...");

  await upgradeNativeStakingSSVStrategy();

  console.log("Running 019 deployment done");
  return true;
};

mainExport.id = "019_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
