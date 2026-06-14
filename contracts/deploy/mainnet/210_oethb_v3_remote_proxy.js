const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployProxyWithCreateX } = require("../deployActions");

// Salt MUST match the Base side (deploy/base/100_oethb_v3_master_proxy.js)
// so Master and Remote land at the same address via CreateX on both chains.
const SALT = "OETHb wOETH V3 Strategy 1";

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "210_oethb_v3_remote_proxy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const proxyAddress = await deployProxyWithCreateX(
      SALT,
      "CrossChainStrategyProxy",
      false,
      null,
      "OETHbV3RemoteProxy"
    );
    console.log(`OETHbV3RemoteProxy address: ${proxyAddress}`);

    return {
      actions: [],
    };
  }
);
