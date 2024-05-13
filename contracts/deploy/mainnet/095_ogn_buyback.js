const { isFork } = require("../../test/helpers");
const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "095_ogn_buyback",
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");

    // const cSwapper = await ethers.getContract("Swapper1InchV5");

    // Deploy new OETHBuyback implementation
    const dOETHBuybackImpl = await deployWithConfirmation(
      "OETHBuyback",
      [
        addresses.mainnet.OETHProxy,
        addresses.mainnet.OGN,
        addresses.mainnet.CVX,
        addresses.mainnet.CVXLocker,
      ],
      undefined,
      true
    );

    // Deploy new OUSDBuyback implementation
    const dOUSDBuybackImpl = await deployWithConfirmation(
      "OUSDBuyback",
      [
        addresses.mainnet.OUSDProxy,
        addresses.mainnet.OGN,
        addresses.mainnet.CVX,
        addresses.mainnet.CVXLocker,
      ],
      undefined,
      true
    );

    // await cSwapper.approveAssets([addresses.mainnet.OGN]);

    if (!isFork) {
      // No Governance action on mainnet
      // To be upgraded with the proposal from `ousd-governance` repo
      return {
        actions: [],
      };
    }

    return {
      name: "Upgrade contracts for OGN Buyback",
      actions: [
        // 1. Upgrade OUSD Buyback to new implementation
        {
          contract: cOUSDBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDBuybackImpl.address],
        },
        // 2. Upgrade OETH Buyback to new implementation
        {
          contract: cOETHBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dOETHBuybackImpl.address],
        },
      ],
    };
  }
);
