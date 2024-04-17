const addresses = require("../utils/addresses");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "092_woeth_ccip_zapper",
    forceDeploy: false,
    reduceQueueTime: true,
  },
  async ({ deployWithConfirmation }) => {
    // Deploy new WOETHCCIPZapper contract
    let destinationChainSelector = "4949039107694359620";
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
