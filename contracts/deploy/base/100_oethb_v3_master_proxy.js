const { deployOnBase } = require("../../utils/deploy-l2");
const { deployProxyWithCreateX } = require("../deployActions");

// Salt for the OETHb wOETH V3 strategy pair. Must match the salt used on the
// Ethereum side so Master (Base) and Remote (Ethereum) deploy to matching
// addresses via CreateX.
//
// Salt-naming convention for V3 cross-chain deployments:
//   * Same salt on PAIRED chains (peer parity is required for the adapter
//     `transportSender == address(this)` check and the strategy `envelopeSender`
//     dispatch).
//   * Different salt between testnet (prefixed with "Testnet" — see
//     `deploy/baseSepolia/002_master_strategy.js`) and production to keep
//     CreateX deployments isolated even when the deployer EOA is identical.
//   * Version suffix (`1`, `2`, …) increments only when deploying a fresh pair
//     while keeping a previous version live.
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
