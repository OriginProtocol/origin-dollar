const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "002_base_oracles",
  },
  async ({ ethers }) => {
    // TODO: Proxy for OracleRouter?

    // Deploy OETHb Oracle Router
    await deployWithConfirmation("OETHBaseOracleRouter", []);

    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    // Cache decimals
    await withConfirmation(
      cOracleRouter.cacheDecimals(addresses.base.BridgedWOETH)
    );

    return {
      actions: [],
    };
  }
);
