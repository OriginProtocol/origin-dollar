const { upgradeNativeStakingSSVStrategy } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");
const addresses = require("../../utils/addresses");
const { parseEther } = require("ethers/lib/utils");
// const { impersonateAndFund } = require("../../utils/signers.js");

const mainExport = async () => {
  console.log("Running 010 deployment on Holesky...");

  console.log("Upgrading native staking strategy");
  await upgradeNativeStakingSSVStrategy();

  const cNativeStakingStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await withConfirmation(
    cNativeStakingStrategy
      .connect(sGovernor)
      // Holesky defender relayer
      .setStakingMonitor(addresses.holesky.Guardian)
  );

  await withConfirmation(
    cNativeStakingStrategy
      .connect(sGovernor)
      .setStakeETHThreshold(parseEther("64"))
  );

  console.log(
    `Set the staking monitor to ${addresses.holesky.Guardian} and stake ETH threshold to 32 ETH`
  );

  console.log("Running 010 deployment done");
  return true;
};

mainExport.id = "010_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
