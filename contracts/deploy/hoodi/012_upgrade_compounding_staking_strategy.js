const { deployWithConfirmation } = require("../../utils/deploy");
const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await deployWithConfirmation("BeaconProofs", []);

  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 012 deployment done");
  return true;
};

mainExport.id = "012_upgrade_compounding_staking_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
