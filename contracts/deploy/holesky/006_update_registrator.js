const { parseEther } = require("ethers/lib/utils");

const { deployNativeStakingSSVStrategy } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");
const addresses = require("../../utils/addresses");

const mainExport = async () => {
  console.log("Running 006 deployment on Holesky...");

  const cNativeStakingStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  await withConfirmation(
    cNativeStakingStrategy
      // Holesky defender relayer
      .setRegistrator(addresses.holesky.validatorRegistrator)
  );

  console.log("Running 006 deployment done");
  return true;
};

mainExport.id = "006_update_registrator";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
