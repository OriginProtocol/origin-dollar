const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "032_convex_rewards", forceDeploy: true },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

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
        // 2. Use CRV as main rewards token and CVX as a secondary
        {
          contract: cConvexStrategy,
          signature: "setRewardTokenAddresseses(address[])",
          args: [[assetAddresses.CRV, assetAddresses.CVX]],
        },
      ],
    };
  }
);
