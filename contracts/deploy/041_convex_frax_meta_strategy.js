const { deploymentWithProposal } = require("../utils/deploy");
const { BigNumber } = require("ethers");

module.exports = deploymentWithProposal(
  { deployName: "041_convex_frax_meta_strategy", forceDeploy: false },
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
    const dConvexFraxMetaStrategyProxy = await deployWithConfirmation(
      "ConvexGeneralizedMetaStrategyProxy"
    );
    const cConvexFraxMetaStrategyProxy = await ethers.getContractAt(
      "ConvexGeneralizedMetaStrategyProxy",
      dConvexFraxMetaStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dConvexFraxMetaStrategyImpl = await deployWithConfirmation(
      "ConvexGeneralizedMetaStrategy"
    );
    const cConvexFraxMetaStrategy = await ethers.getContractAt(
      "ConvexGeneralizedMetaStrategy",
      dConvexFraxMetaStrategyImpl.address
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cConvexFraxMetaStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dConvexFraxMetaStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new Convex Frax Meta strategy
    const initFunction =
      "initialize(address[],address[],address[],address[],uint256)";
    await withConfirmation(
      cConvexFraxMetaStrategy.connect(sDeployer)[initFunction](
        [assetAddresses.CVX, assetAddresses.CRV],
        [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
        [
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
          assetAddresses.ThreePoolToken,
        ],
        [
          assetAddresses.ThreePool,
          cVaultProxy.address,
          "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", // _cvxDepositorAddress,
          "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B", // _metapoolAddress
          "0x853d955acef822db058eb8505911ed77f175b99e", // _fraxAddress
          "0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e", // _cvxRewardStakerAddress,
        ],
        32, // _cvxDepositorPTokenId
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cConvexFraxMetaStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    console.log("FRAX META STRATEGY ADDRESS", dConvexFraxMetaStrategyProxy.address);
    const fiftyMil = BigNumber.from(50000000).mul(BigNumber.from(10).pow(18));
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Convex FRAX Meta strategy",
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
          contract: cConvexFraxMetaStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 4. Add new Convex strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cConvexFraxMetaStrategy.address],
        },
        // 5. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexFraxMetaStrategyProxy.address, true],
        },
        // 6. Set harvester address
        {
          contract: cConvexFraxMetaStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
