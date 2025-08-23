const { deployWithConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");
const { upgradeCompoundingStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  await deployWithConfirmation("BeaconProofs", []);

  await upgradeCompoundingStakingSSVStrategy();

  const cStrategyProxy = await resolveContract(
    "CompoundingStakingSSVStrategyProxy"
  );

  await deployWithConfirmation("CompoundingStakingStrategyView", [
    cStrategyProxy.address,
  ]);

  return true;
};

mainExport.id = "019_upgrade_staking_contract";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
