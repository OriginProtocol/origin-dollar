const {
  upgradeCompoundingStakingSSVStrategy,
  upgradeNativeStakingSSVStrategy,
} = require("../deployActions.js");

const mainExport = async () => {
  // 1. Upgrade the Compounding Staking Strategy
  await upgradeCompoundingStakingSSVStrategy();

  // 2. Upgrade the Native Staking Strategy
  await upgradeNativeStakingSSVStrategy();

  console.log("Running 036 deployment done");
  return true;
};

mainExport.id = "036_validator_consolidation_upgrade";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
