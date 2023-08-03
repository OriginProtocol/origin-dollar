const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "032_convex_rewards", forceDeploy: false },
  async ({ assetAddresses, deployWithConfirmation, ethers }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new implementation
    const dConvexStrategyImpl = await deployWithConfirmation(
      "ConvexStrategy",
      undefined,
      undefined,
      true // Disable storage slot checking. We are intentionally renaming a slot.
    );
    const cConvexStrategyProxy = await ethers.getContract(
      "ConvexStrategyProxy"
    );
    console.log(cConvexStrategyProxy.address);
    const cConvexStrategy = await ethers.getContractAt(
      "ConvexStrategy",
      cConvexStrategyProxy.address
    );
    console.log("ConvexStrategyProxy ", await cConvexStrategyProxy.governor());

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new Convex implementation",
      actions: [
        // 1. Upgrade implementation
        {
          contract: cConvexStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexStrategyImpl.address],
        },
        // 2. Use CRV as main rewards token
        {
          contract: cConvexStrategy,
          signature: "setRewardTokenAddress(address)",
          args: [assetAddresses.CRV],
        },
        // 3. Use correct CVX token address
        {
          contract: cConvexStrategy,
          signature: "setCvxRewardTokenAddress(address)",
          args: [assetAddresses.CVX],
        },
      ],
    };
  }
);
