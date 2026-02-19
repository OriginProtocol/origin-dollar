const { isFork } = require("../../test/helpers.js");

const {
  deployOracles,
  deployCore,
  deployNativeStakingSSVStrategy,
  deployCompoundingStakingSSVStrategy,
  deploySimpleOETHHarvester,
  configureVault,
  configureOETHVault,
  deployUniswapV3Pool,
  deployVaultValueChecker,
  deployWOusd,
  deployWOeth,
  deployCrossChainUnitTestStrategy,
} = require("../deployActions");

const main = async () => {
  console.log("Running 001_core deployment...");
  const usdc = await ethers.getContract("MockUSDC");

  await deployOracles();
  await deployCore();
  await deployNativeStakingSSVStrategy();
  await deployCompoundingStakingSSVStrategy();
  await deploySimpleOETHHarvester();
  await configureVault();
  await configureOETHVault();
  await deployUniswapV3Pool();
  await deployVaultValueChecker();
  await deployWOusd();
  await deployWOeth();
  await deployCrossChainUnitTestStrategy(usdc.address);
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.tags = ["unit_tests", "arb_unit_tests"];
main.skip = () => isFork;

module.exports = main;
