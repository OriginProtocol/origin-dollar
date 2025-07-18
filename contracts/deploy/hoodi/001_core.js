const {
  deployOracles,
  deployOETHCore,
  deployNativeStakingSSVStrategy,
  deployCompoundingStakingSSVStrategy,
  deployBeaconContracts,
  configureOETHVault,
} = require("../deployActions");
const addresses = require("../../utils/addresses.js");

const { withConfirmation } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../test/helpers");

const mainExport = async () => {
  console.log("Running 001_core deployment on Hoodi...");
  const { deployerAddr } = await getNamedAccounts();
  // deployer is govenor
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  if (isFork) {
    // Fund the deployer on fork
    impersonateAndFund(deployerAddr, "10000");
  }

  console.log("Deploying Oracles");
  await deployOracles();
  console.log("Deploying Core");
  await deployOETHCore();

  console.log("Deploying Native Staking");
  await deployNativeStakingSSVStrategy();

  console.log("Deploy beacon contracts");
  await deployBeaconContracts();

  console.log("Deploy compounding ssv strategy");
  const compoundingSsvStrategy = await deployCompoundingStakingSSVStrategy();

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

  // await withConfirmation(
  //   nativeStakingSSVStrategy
  //     .connect(sDeployer)
  //     .setHarvesterAddress(cOETHHarvester.address)
  // );

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .approveStrategy(nativeStakingSSVStrategyProxy.address)
  );

  await withConfirmation(
    cVault.connect(sDeployer).approveStrategy(compoundingSsvStrategy.address)
  );

  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sDeployer)
      .setRegistrator(addresses.hoodi.defenderRelayer)
  );
  await withConfirmation(
    nativeStakingSSVStrategy
      .connect(sDeployer)
      .addTargetStrategy(compoundingSsvStrategy.address)
  );

  await withConfirmation(
    compoundingSsvStrategy
      .connect(sDeployer)
      .addSourceStrategy(nativeStakingSSVStrategy.address)
  );
  await withConfirmation(
    compoundingSsvStrategy
      .connect(sDeployer)
      .setRegistrator(addresses.hoodi.defenderRelayer)
  );


  console.log("001_core deploy done.");
  return true;
};

mainExport.id = "001_core";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
