const { deployOnBase } = require("../../utils/deploy-l2");
const { deployProxyWithCreateX } = require("../deployActions");

// Salt for the OETHb wOETH V3 strategy pair. Must match the salt used on the
// Ethereum side so Master (Base) and Remote (Ethereum) deploy to matching
// addresses via CreateX.
const SALT = "OETHb wOETH V3 Strategy 1";

module.exports = deployOnBase(
  {
    deployName: "100_oethb_v3_master_proxy",
  },
  async () => {
    const proxyAddress = await deployProxyWithCreateX(
      SALT,
      "CrossChainStrategyProxy",
      false,
      null,
      "OETHbV3MasterProxy"
    );
    console.log(`OETHbV3MasterProxy address: ${proxyAddress}`);

    return {
      actions: [],
    };
  }
);
