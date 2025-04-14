const { isFork } = require("../../test/helpers.js");

const {
  deployOracles,
  deployCore,
  deployCurveMetapoolMocks,
  deployCompoundStrategy,
  deployAaveStrategy,
  deployConvexStrategy,
  deployNativeStakingSSVStrategy,
  deployDrippers,
  deployHarvesters,
  configureVault,
  configureOETHVault,
  configureStrategies,
  deployBuyback,
  deployUniswapV3Pool,
  deployVaultValueChecker,
  deployWOusd,
  deployWOeth,
  deployOETHSwapper,
  deployOUSDSwapper,
} = require("../deployActions");

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  await deployCurveMetapoolMocks();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployConvexStrategy();
  await deployNativeStakingSSVStrategy();
  const [ousdDripper, oethDripper] = await deployDrippers();
  const [harvesterProxy, oethHarvesterProxy] = await deployHarvesters(
    ousdDripper,
    oethDripper
  );
  await configureVault();
  await configureOETHVault(false);
  await configureStrategies(harvesterProxy, oethHarvesterProxy);
  await deployBuyback();
  await deployUniswapV3Pool();
  await deployVaultValueChecker();
  await deployWOusd();
  await deployWOeth();
  await deployOETHSwapper();
  await deployOUSDSwapper();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.tags = ["unit_tests", "arb_unit_tests"];
main.skip = () => isFork;

module.exports = main;
