const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "022_convex" },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    // Signers
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    // Current contracts
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      assetAddresses.VaultProxy
    );
    const oldThreePoolStrategyAddress =
      "0x3c5fe0a3922777343CBD67D3732FCdc9f2Fa6f2F";

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dConvexStrategyProxy = await deployWithConfirmation(
      "ConvexStrategyProxy",
      [],
      "InitializeGovernedUpgradeabilityProxy"
    );
    const cConvexStrategyProxy = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      dConvexStrategyProxy.address
    );
    // 2. Deploy new implementation
    const dConvexStrategyImpl = await deployWithConfirmation("ConvexStrategy");
    const cConvexStrategy = await ethers.getContractAt(
      "ConvexStrategy",
      dConvexStrategyProxy.address
    );
    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cConvexStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dConvexStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new Convex strategy
    const initFunction =
      "initialize(address,address,address,address[],address[],address,address)";
    await withConfirmation(
      cConvexStrategy.connect(sDeployer)[initFunction](
        assetAddresses.ThreePool,
        assetAddresses.VaultProxy,
        assetAddresses.CRV,
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", // _cvxDepositorAddress,
        "0x689440f2ff927e1f24c72f1087e1faf471ece1c8", // _cvxRewardStakerAddress,
        9, // _cvxDepositorPTokenId
        await getTxOpts()
      )
    );
    // 5. Transfer governance
    await withConfirmation(
      cConvexStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new Convex strategy",
      actions: [
        // 1. Accept governance of new AAVEStrategy
        {
          contract: cConvexStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Remove old ThreePool strategy from vault
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [oldThreePoolStrategyAddress],
        },
        // 3. Add new Convex strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cConvexStrategy.address],
        },
      ],
    };
  }
);
