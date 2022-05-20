const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "040_convex_meta_strategy", forceDeploy: true },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dVaultCore = await deployWithConfirmation("VaultCore");

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dConvexMetaStrategyProxy = await deployWithConfirmation(
      "ConvexMetaStrategyProxy"
    );
    const cConvexMetaStrategyProxy = await ethers.getContractAt(
      "ConvexMetaStrategyProxy",
      dConvexMetaStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dConvexMetaStrategyImpl = await deployWithConfirmation(
      "ConvexMetaStrategy"
    );
    const cConvexMetaStrategy = await ethers.getContractAt(
      "ConvexMetaStrategy",
      dConvexMetaStrategyProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cConvexMetaStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dConvexMetaStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new Convex Meta strategy
    const initFunction =
      "initialize(address,address,address[],address[],address[],address,address,address)";
    await withConfirmation(
      cConvexMetaStrategy.connect(sDeployer)[initFunction](
        assetAddresses.ThreePool,
        cVaultProxy.address,
        [assetAddresses.CVX, assetAddresses.CRV],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", // _cvxDepositorAddress,
        "0x87650d7bbfc3a9f10587d7778206671719d9910d", // _metapoolAddress
        "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86", // _ousdAddress
        await getTxOpts()
      )
    );

    // 4,5. Init and configure new Convex Meta strategy
    const initFunction2 = "initialize2(address,uint256)";
    await withConfirmation(
      cConvexMetaStrategy.connect(sDeployer)[initFunction2](
        "0x7D536a737C13561e0D2Decf1152a653B4e615158", // _cvxRewardStakerAddress,
        56, // _cvxDepositorPTokenId
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cConvexMetaStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    console.log("META STRATEGY ADDRESS", dConvexMetaStrategyProxy.address);
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Convex Meta strategy",
      actions: [
        // 1. Set VaultCore implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Accept governance of new ConvexStrategy
        {
          contract: cConvexMetaStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 4. Add new Convex strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cConvexMetaStrategy.address],
        },
        // 5. Set OUSD meta strategy on Vault Admin contract
        {
          contract: cVaultAdmin,
          signature: "setOusdMetaStrategy(address)",
          args: [cConvexMetaStrategy.address],
        },
      ],
    };
  }
);
