const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "137_strategist_does_buyback",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Proxy contracts
    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cARMBuybackProxy = await ethers.getContract("ARMBuybackProxy");

    // Old buyback contracts
    const cOldOUSDBuyback = await ethers.getContractAt(
      ["function updateBuybackSplits() external"],
      cOUSDBuybackProxy.address
    );
    const cOldOETHBuyback = await ethers.getContractAt(
      ["function updateBuybackSplits() external"],
      cOETHBuybackProxy.address
    );

    // New buyback contracts
    await deployWithConfirmation("OUSDBuyback", [], undefined, true);
    const cNewOUSDBuyback = await ethers.getContract("OUSDBuyback");
    await deployWithConfirmation("OETHBuyback", [], undefined, true);
    const cNewOETHBuyback = await ethers.getContract("OETHBuyback");
    await deployWithConfirmation("ARMBuyback", [], undefined, true);
    const cNewARMBuyback = await ethers.getContract("ARMBuyback");

    // Deployer Actions
    // ----------------
    return {
      name: "Strategist does buyback",
      actions: [
        // Update splits to make calculations easier for us
        {
          contract: cOldOUSDBuyback,
          signature: "updateBuybackSplits()",
          args: [],
        },
        {
          contract: cOldOETHBuyback,
          signature: "updateBuybackSplits()",
          args: [],
        },
        // Upgrade proxies to new implementations
        {
          contract: cOUSDBuybackProxy,
          signature: "upgradeTo(address)",
          args: [cNewOUSDBuyback.address],
        },
        {
          contract: cOETHBuybackProxy,
          signature: "upgradeTo(address)",
          args: [cNewOETHBuyback.address],
        },
        {
          contract: cARMBuybackProxy,
          signature: "upgradeTo(address)",
          args: [cNewARMBuyback.address],
        },
      ],
    };
  }
);
