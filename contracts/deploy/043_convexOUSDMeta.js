const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { BigNumber } = require("ethers");

module.exports = deploymentWithProposal(
  {
    deployName: "043_convex_OUSD_meta_strategy",
    forceDeploy: false,
    proposalId: 38,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr } = await getNamedAccounts();
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
    const dConvexOUSDMetaStrategyProxy = await deployWithConfirmation(
      "ConvexOUSDMetaStrategyProxy"
    );
    const cConvexOUSDMetaStrategyProxy = await ethers.getContractAt(
      "ConvexOUSDMetaStrategyProxy",
      dConvexOUSDMetaStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dConvexOUSDMetaStrategyImpl = await deployWithConfirmation(
      "ConvexOUSDMetaStrategy"
    );
    const cConvexOUSDMetaStrategy = await ethers.getContractAt(
      "ConvexOUSDMetaStrategy",
      dConvexOUSDMetaStrategyProxy.address
    );

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cConvexOUSDMetaStrategyProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dConvexOUSDMetaStrategyImpl.address, deployerAddr, [], await getTxOpts())
    );

    // 4. Init and configure new Convex OUSD Meta strategy
    const initFunction =
      "initialize(address[],address[],address[],(address,address,address,address,address,address,address,uint256))";
    await withConfirmation(
      cConvexOUSDMetaStrategy.connect(sDeployer)[initFunction](
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
          addresses.mainnet.CVXBooster, // _cvxDepositorAddress,
          addresses.mainnet.CurveOUSDMetaPool, // _metapoolAddress
          addresses.mainnet.OUSDProxy, // _ousdAddress
          addresses.mainnet.CVXRewardsPool, // _cvxRewardStakerAddress,
          addresses.mainnet.CurveOUSDMetaPool, // metapoolLPToken (_metapoolAddress)
          56, // _cvxDepositorPTokenId
        ],
        await getTxOpts()
      )
    );

    // 5. Transfer governance
    await withConfirmation(
      cConvexOUSDMetaStrategy
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Timelock, await getTxOpts())
    );

    console.log(
      "OUSD META STRATEGY ADDRESS",
      dConvexOUSDMetaStrategyProxy.address
    );
    const fiftyMil = BigNumber.from(50000000).mul(BigNumber.from(10).pow(18));
    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Convex OUSD Meta strategy",
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
          contract: cConvexOUSDMetaStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 4. Add new Convex strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cConvexOUSDMetaStrategy.address],
        },
        // 5. Set OUSD meta strategy on Vault Admin contract
        {
          contract: cVaultAdmin,
          signature: "setOusdMetaStrategy(address)",
          args: [cConvexOUSDMetaStrategy.address],
        },
        // 6. Set net OUSD Mint for strategy threshold
        {
          contract: cVaultAdmin,
          signature: "setNetOusdMintForStrategyThreshold(uint256)",
          // TODO: set at an arbitrary 50m?
          args: [fiftyMil],
        },
        // 7. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexOUSDMetaStrategyProxy.address, true],
        },
        // 8. Set harvester address
        {
          contract: cConvexOUSDMetaStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
