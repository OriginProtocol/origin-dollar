const { deployWithConfirmation } = require("../../utils/deploy");
const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await deployWithConfirmation("BeaconProofs", []);

  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 015 deployment done");
  return true;
};

mainExport.id = "015_upgrade_staking_contract";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
