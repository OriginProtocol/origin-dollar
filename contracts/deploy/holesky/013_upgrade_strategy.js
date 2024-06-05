const { parseEther } = require("ethers/lib/utils");

const { upgradeNativeStakingSSVStrategy } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");

const mainExport = async () => {
  console.log("Running 013 deployment on Holesky...");

  console.log("Upgrading native staking strategy");
  await upgradeNativeStakingSSVStrategy();

  const nativeStakingSSVStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const fuseStartBn = parseEther("21.6");
  const fuseEndBn = parseEther("25.6");

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setFuseInterval(fuseStartBn, fuseEndBn)
  );

  console.log("Running 012 deployment done");
  return true;
};

mainExport.id = "013_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
