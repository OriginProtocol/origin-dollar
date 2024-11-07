const { isFork } = require("../../test/helpers.js");

const {
  deployOracles,
  deployCore,
  deployCurveMetapoolMocks,
  deployCurveLUSDMetapoolMocks,
  deployCompoundStrategy,
  deployAaveStrategy,
  deployThreePoolStrategy,
  deployConvexStrategy,
  deployConvexOUSDMetaStrategy,
  deployConvexLUSDMetaStrategy,
  deployNativeStakingSSVStrategy,
  deployFraxEthStrategy,
  deployDrippers,
  deployHarvesters,
  configureVault,
  configureOETHVault,
  configureStrategies,
  deployFlipper,
  deployBuyback,
  deployUniswapV3Pool,
  deployVaultValueChecker,
  deployWOusd,
  deployWOETH,
  deployOETHSwapper,
  deployOUSDSwapper,
  deployDirectStakingHandler,
} = require("../deployActions");

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  await deployCurveMetapoolMocks();
  await deployCurveLUSDMetapoolMocks();
  await deployCompoundStrategy();
  await deployAaveStrategy();
  await deployThreePoolStrategy();
  await deployConvexStrategy();
  await deployConvexOUSDMetaStrategy();
  await deployConvexLUSDMetaStrategy();
  await deployNativeStakingSSVStrategy();
  await deployFraxEthStrategy();
  const [ousdDripper, oethDripper] = await deployDrippers();
  const [harvesterProxy, oethHarvesterProxy] = await deployHarvesters(
    ousdDripper,
    oethDripper
  );
  await configureVault();
  await configureOETHVault(false);
  await configureStrategies(harvesterProxy, oethHarvesterProxy);
  await deployFlipper();
  await deployBuyback();
  await deployUniswapV3Pool();
  await deployVaultValueChecker();
  await deployWOusd();
  await deployWOETH();
  await deployOETHSwapper();
  await deployOUSDSwapper();

  await deployDirectStakingHandler();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];
main.tags = ["unit_tests", "arb_unit_tests"];
main.skip = () => isFork;

module.exports = main;
