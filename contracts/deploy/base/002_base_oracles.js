const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "002_base_oracles",
  },
  async ({ ethers }) => {
    // TODO: Proxy for OracleRouter?

    // Deploy PriceFeedPair for Aero/WETH
    await deployWithConfirmation(
      "AeroETHPriceFeed",
      [
        addresses.base.aeroUsdPriceFeed,
        addresses.base.ethUsdPriceFeed,
        false,
        true,
      ],
      "PriceFeedPair"
    );
    const aeroPriceFeed = await ethers.getContract("AeroETHPriceFeed");
    console.log("Deployed PriceFeedPair for Aero/USD and Aero/ETH pair");

    // Deploy OETHb Oracle Router
    await deployWithConfirmation("OETHBaseOracleRouter", [
      aeroPriceFeed.address,
    ]);

    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    // Cache decimals
    await withConfirmation(
      cOracleRouter.cacheDecimals(addresses.base.BridgedWOETH)
    );
    await withConfirmation(cOracleRouter.cacheDecimals(addresses.base.AERO));

    return {
      actions: [],
    };
  }
);
