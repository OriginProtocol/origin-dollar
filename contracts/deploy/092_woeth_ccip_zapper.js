const addresses = require("../utils/addresses");
const { ccip_arbChainSelector } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "092_woeth_ccip_zapper",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deploy new WOETHCCIPZapper contract
    let destinationChainSelector = ccip_arbChainSelector;
    let woethOnSourceChain = addresses.mainnet.WOETHProxy;
    let woethOnDestinationChain = addresses.arbitrumOne.WOETHProxy;
    let oethZapper = addresses.mainnet.OETHZapper;
    let ccipRouter = addresses.mainnet.ccipRouterMainnet;
    let oeth = addresses.mainnet.OETHProxy;

    await deployWithConfirmation("WOETHCCIPZapper", [
      ccipRouter,
      destinationChainSelector,
      woethOnSourceChain,
      woethOnDestinationChain,
      oethZapper,
      oeth,
    ]);

    // Governance Actions
    // ----------------
    return {
      name: "No actions",
      actions: [],
    };
  }
);
