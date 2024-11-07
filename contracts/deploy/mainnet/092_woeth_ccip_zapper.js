const addresses = require("../../utils/addresses");
const { ccip_arbChainSelector } = require("../../utils/constants");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "092_woeth_ccip_zapper",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deploy new WOETHCCIPZapper contract
    const destinationChainSelector = ccip_arbChainSelector;
    const woethOnSourceChain = addresses.mainnet.WOETHProxy;
    const woethOnDestinationChain = addresses.arbitrumOne.WOETHProxy;
    const oethZapper = addresses.mainnet.OETHZapper;
    const ccipRouter = addresses.mainnet.ccipRouter;
    const oeth = addresses.mainnet.OETHProxy;

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
