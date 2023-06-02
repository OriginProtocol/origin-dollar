const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "065_oeth_swapper", forceDeploy: false, reduceQueueTime: true },
  async ({ assetAddresses, deployWithConfirmation, withConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new Swapper contract for 1Inch V5
    await deployWithConfirmation("Swapper1InchV5");
    const cSwapper = await ethers.getContract("Swapper1InchV5");

    await withConfirmation(
      cSwapper.approveAssets([
        assetAddresses.RETH,
        assetAddresses.stETH,
        assetAddresses.WETH,
        assetAddresses.frxETH,
      ])
    );

    // Governance Actions
    // ----------------
    return {
      name: "No actions",
      actions: [],
    };
  }
);
