const hre = require("hardhat");
const main = require("../deploy/001_core.js");

const { 
	upgradeNativeStakingSSVStrategy,
} = main.functions;

const {
  withConfirmation,
} = require("../utils/deploy");

const mainExport = async () => {
	console.log("Running 002_core deployment on Holesky...");
	const { governorAddr } = await getNamedAccounts();
	const sGovernor = await ethers.provider.getSigner(governorAddr);

	console.log("Deploying Oracles");
	await deployOracles();
	console.log("Deploying Core");
	await deployOETHCore();
	console.log("Deploying Native Staking");
	await deployNativeStakingSSVStrategy();
	
	const cOETHDripper = await deployOETHDripper();
	const cOETHHarvester = await deployOETHHarvester(cOETHDripper);
	await configureOETHVault(true);

	const cVault = await ethers.getContractAt(
    "IVault",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );

  const nativeStakingSSVStrategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );

  const nativeStakingSSVStrategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    nativeStakingSSVStrategyProxy.address
  );

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setHarvesterAddress(cOETHHarvester.address)
  );

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .approveStrategy(nativeStakingSSVStrategyProxy.address)
  );

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setRegistrator(governorAddr)
  );

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sGovernor)
      .setAccountingGovernor(governorAddr)
  );

	console.log("001_core deploy done.");
	return true;
};

mainExport.id = "002_upgrade_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;