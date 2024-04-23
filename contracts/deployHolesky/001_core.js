const hre = require("hardhat");
const main = require("../deploy/001_core.js");

const { id, tags } = main;
const { 
	deployOracles,
	deployOETHCore,
	deployNativeStakingSSVStrategy,
	deployOETHDripper,
	deployOETHHarvester,
	configureOETHVault
} = main.functions;

const {
  withConfirmation,
} = require("../utils/deploy");

const mainExport = async () => {
	console.log("Running 001_core deployment on Holesky...");
	const { governorAddr } = await getNamedAccounts();
	const sGovernor = await ethers.provider.getSigner(governorAddr);

  	await deployOracles();
  	await deployOETHCore();
  	await deployNativeStakingSSVStrategy();
  	const cOETHDripper = await deployOETHDripper();
  	const cOETHHarvester = await deployOETHHarvester(cOETHDripper);
	await configureOETHVault(true);

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

  	console.log("001_core deploy done.");
  	return true;
};

mainExport.id = id;
mainExport.tags = tags;
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;