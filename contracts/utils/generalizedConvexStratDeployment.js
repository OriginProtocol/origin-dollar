const { deploymentWithProposal } = require("../utils/deploy");
const { BigNumber } = require("ethers");

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
}) => {
  return deploymentWithProposal(
    { deployName, forceDeploy },
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

      // 2. Deploy new implementation
      const dConvexTokenMetaStrategyImpl = await deployWithConfirmation(
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
            dConvexTokenMetaStrategyImpl.address,
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
        "initialize(address[],address[],address[],address[],uint256)";
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
            ],
            cvxDepositorPTokenId,
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
      // Governance Actions
      // ----------------
      return {
        name: `Deploy new Convex ${mainTokenName} Meta strategy`,
        actions: [
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
