const { deploymentWithProposal } = require("../utils/deploy");
const { BigNumber } = require("ethers");
const { isMainnet } = require("../test/helpers.js");

module.exports = ({
  deployName,
  forceDeploy,
  mainTokenName,
  mainTokenSymbol,
  rewardTokenNames,
  assets,
  pTokens,
  platformAddress,
  cvxDepositorAddress,
  metapoolAddress,
  metapoolLPToken,
  mainTokenAddress,
  cvxRewardStakerAddress,
  cvxDepositorPTokenId,
  redeployVault,
  // we only need to deploy the implementation contract for first time & when it changes
  deployStrategyImplementation,
  skipMainnetDeploy,
  proposalId,
}) => {
  return deploymentWithProposal(
    {
      deployName,
      forceDeploy,
      forceSkip: isMainnet && skipMainnetDeploy,
      proposalId,
    },
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
      const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
      const proxyName = `Convex${mainTokenSymbol}MetaStrategyProxy`;

      // Deployer Actions
      // ----------------

      // 1. Deploy new proxy
      // New strategy will be living at a clean address
      const dConvexTokenMetaStrategyProxy = await deployWithConfirmation(
        proxyName
      );
      const cConvexTokenMetaStrategyProxy = await ethers.getContractAt(
        proxyName,
        dConvexTokenMetaStrategyProxy.address
      );

      if (deployStrategyImplementation) {
        // Deploy new implementation
        const dConvexTokenMetaStrategyImpl = await deployWithConfirmation(
          "ConvexGeneralizedMetaStrategy"
        );
      }

      const convexTokenMetaStrategyImpl = await ethers.getContract(
        "ConvexGeneralizedMetaStrategy"
      );

      const cConvexTokenMetaStrategy = await ethers.getContractAt(
        "ConvexGeneralizedMetaStrategy",
        dConvexTokenMetaStrategyProxy.address
      );

      const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
      const cHarvester = await ethers.getContractAt(
        "Harvester",
        cHarvesterProxy.address
      );

      // 3. Init the proxy to point at the implementation
      await withConfirmation(
        cConvexTokenMetaStrategyProxy
          .connect(sDeployer)
          ["initialize(address,address,bytes)"](
            convexTokenMetaStrategyImpl.address,
            deployerAddr,
            [],
            await getTxOpts()
          )
      );

      const tokenNameToAddress = (tokenNames) => {
        return tokenNames.map((name) => assetAddresses[name]);
      };

      // 4. Init and configure new Convex Token Meta strategy
      const initFunction =
        "initialize(address[],address[],address[],(address,address,address,address,address,address,address,uint256))";
      await withConfirmation(
        cConvexTokenMetaStrategy
          .connect(sDeployer)
          [initFunction](
            tokenNameToAddress(rewardTokenNames),
            tokenNameToAddress(assets),
            tokenNameToAddress(pTokens),
            [
              tokenNameToAddress(platformAddress)[0],
              cVaultProxy.address,
              cvxDepositorAddress,
              metapoolAddress,
              mainTokenAddress,
              cvxRewardStakerAddress,
              metapoolLPToken,
              cvxDepositorPTokenId,
            ],
            await getTxOpts()
          )
      );

      // 5. Transfer governance
      await withConfirmation(
        cConvexTokenMetaStrategy
          .connect(sDeployer)
          .transferGovernance(governorAddr, await getTxOpts())
      );

      console.log(
        mainTokenName + " meta strategy address",
        dConvexTokenMetaStrategyProxy.address
      );

      const additionalActions = [];
      if (redeployVault) {
        const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
        const dVaultCore = await deployWithConfirmation("VaultCore");

        additionalActions.push(
          // 1. Set VaultAdmin implementation
          {
            contract: cVault,
            signature: "setAdminImpl(address)",
            args: [dVaultAdmin.address],
          }
        );
        additionalActions.push(
          // 2. Set VaultCore implementation
          {
            contract: cVaultProxy,
            signature: "upgradeTo(address)",
            args: [dVaultCore.address],
          }
        );
      }

      // Governance Actions
      // ----------------
      return {
        name: `Deploy new Convex ${mainTokenName} Meta strategy`,
        actions: [
          ...additionalActions,
          // 1. Accept governance of new ConvexMetaStrategy
          {
            contract: cConvexTokenMetaStrategy,
            signature: "claimGovernance()",
            args: [],
          },
          // 2. Add new Convex strategy to vault
          {
            contract: cVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cConvexTokenMetaStrategy.address],
          },
          // 3. Set supported strategy on Harvester
          {
            contract: cHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cConvexTokenMetaStrategyProxy.address, true],
          },
          // 4. Set harvester address
          {
            contract: cConvexTokenMetaStrategy,
            signature: "setHarvesterAddress(address)",
            args: [cHarvesterProxy.address],
          },
        ],
      };
    }
  );
};
