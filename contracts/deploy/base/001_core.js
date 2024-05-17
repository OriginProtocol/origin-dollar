const { hardhatSetBalance } = require("../../test/_fund");
const { isFork } = require("../../test/helpers");
const {
  deployOracles,
  deployOETHCore,
  deployOETHDripper,
  configureOETHVault,
} = require("../deployActions");

const mainExport = async () => {
  console.log("Running 001_core deployment on Base...");

  // const { deployerAddr } = await getNamedAccounts();
  // if (isFork) {
  //   await hardhatSetBalance(deployerAddr);
  // }

  console.log("Deploying Oracles");
  await deployOracles();

  console.log("Deploying OETH Core");
  await deployOETHCore();

  console.log("Deploying OETH Dripper");
  await deployOETHDripper();

  console.log("Configuring OETH Vault");
  await configureOETHVault(true);

  console.log("001_core deploy done.");
  return true;
};

mainExport.id = "001_core";
mainExport.tags = ["base"];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
