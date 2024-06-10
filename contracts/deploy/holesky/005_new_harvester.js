const { parseEther } = require("ethers/lib/utils");

const { deployNativeStakingSSVStrategy } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");

const mainExport = async () => {
  console.log("Running 005 deployment on Holesky...");

  console.log("Deploying a new Native Staking strategy and proxy");

  console.log("Deploying Native Staking");
  const nativeStakingSSVStrategy = await deployNativeStakingSSVStrategy();

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cOETHHarvester = await resolveContract(
    "OETHHarvesterProxy",
    "OETHHarvester"
  );
  const cVault = await resolveContract("OETHVaultProxy", "VaultAdmin");

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(cOETHHarvester.address)
  );

  console.log("configuring harvester and the strategy");
  await withConfirmation(
    cOETHHarvester
      .connect(sGovernor)
      .setSupportedStrategy(nativeStakingSSVStrategy.address, true)
  );

  await withConfirmation(
    cVault.connect(sGovernor).approveStrategy(nativeStakingSSVStrategy.address)
  );

  await withConfirmation(
    nativeStakingSSVStrategy.connect(sGovernor).setRegistrator(governorAddr)
  );

  const fuseStartBn = parseEther("21.6");
  const fuseEndBn = parseEther("25.6");

  await nativeStakingSSVStrategy
    .connect(sGovernor)
    .setFuseInterval(fuseStartBn, fuseEndBn);

  console.log("Running 005 deployment done");
  return true;
};

mainExport.id = "005_deploy_new_harvester";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
