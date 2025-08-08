const {
  deployBeaconContracts,
  upgradeCompoundingStakingSSVStrategy,
} = require("../deployActions");

const mainExport = async () => {
  console.log(
    "Running 007_upgrade_compounding_staking_strategy deployment on Hoodi..."
  );

  await deployBeaconContracts();

  await upgradeCompoundingStakingSSVStrategy();

  console.log("Running 007 deployment done");
  return true;
};

mainExport.id = "007_upgrade_compounding_staking_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
