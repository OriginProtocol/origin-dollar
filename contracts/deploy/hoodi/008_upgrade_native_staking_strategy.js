const { upgradeNativeStakingSSVStrategy } = require("../deployActions");

const mainExport = async () => {
  console.log(
    "Running 008_upgrade_native_staking_strategy deployment on Hoodi..."
  );

  await upgradeNativeStakingSSVStrategy();

  console.log("Running 008 deployment done");
  return true;
};

mainExport.id = "008_upgrade_native_staking_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
