const {
  deployOracles,
  deployOETHCore,
  deployOETHDripper,
  deployOETHHarvester,
  configureOETHVault,
} = require("../deployActions");

//const { withConfirmation } = require("../../utils/deploy");
const { hardhatSetBalance } = require("../../test/_fund.js");
const { isSonicFork } = require("../../test/helpers.js");

const mainExport = async () => {
  console.log("Running 001_core deployment on Sonic...");
  //const { governorAddr } = await getNamedAccounts();
  //const sGovernor = await ethers.provider.getSigner(governorAddr);


  if (isSonicFork) {
      const { deployerAddr } = await getNamedAccounts();
      await hardhatSetBalance(deployerAddr, "10000000000");
  }

  await deployOracles();
  await deployOETHCore();

  const cOETHDripper = await deployOETHDripper({ skipUpgradeSafety: true });
  const cOETHHarvester = await deployOETHHarvester(cOETHDripper);
  await configureOETHVault("sonicOETH");

  // const cVault = await ethers.getContractAt(
  //   "IVault",
  //   (
  //     await ethers.getContract("OETHVaultProxy")
  //   ).address
  // );

  // const nativeStakingSSVStrategyProxy = await ethers.getContract(
  //   "NativeStakingSSVStrategyProxy"
  // );

  // const nativeStakingSSVStrategy = await ethers.getContractAt(
  //   "NativeStakingSSVStrategy",
  //   nativeStakingSSVStrategyProxy.address
  // );

  // await withConfirmation(
  //   nativeStakingSSVStrategy
  //     .connect(sGovernor)
  //     .setHarvesterAddress(cOETHHarvester.address)
  // );

  // await withConfirmation(
  //   cVault
  //     .connect(sGovernor)
  //     .approveStrategy(nativeStakingSSVStrategyProxy.address)
  // );

  // await withConfirmation(
  //   nativeStakingSSVStrategy.connect(sGovernor).setRegistrator(governorAddr)
  // );

  // await withConfirmation(
  //   nativeStakingSSVStrategy
  //     .connect(sGovernor)
  //     .setAccountingGovernor(governorAddr)
  // );

  console.log("001_core deploy done.");
  return true;
};

mainExport.id = "001_core";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;