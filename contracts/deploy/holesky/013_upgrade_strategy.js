const { parseEther } = require("ethers/lib/utils");

const {
  upgradeNativeStakingFeeAccumulator,
  upgradeNativeStakingSSVStrategy,
} = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");

const log = require("../../utils/logger")("deploy:holesky:014");

const mainExport = async () => {
  console.log("Running 013 deployment on Holesky...");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await upgradeNativeStakingFeeAccumulator();

  await upgradeNativeStakingSSVStrategy();

  const nativeStakingSSVStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );
  log(`About to setStakeETHThreshold`);
  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setStakeETHThreshold(parseEther("512"))
  );
  log(`Set stakeETHThreshold to 512 ether`);

  console.log("Running 013 deployment done");
  return true;
};

mainExport.id = "013_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
