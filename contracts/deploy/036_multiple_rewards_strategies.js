const { deploymentWithProposal, log } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "036_multiple_rewards_public_harvest", forceDeploy: false },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const dVaultAdmin = await deployWithConfirmation(
      "VaultAdmin",
      undefined,
      undefined,
      true // Disable storage slot checking, we are renaming variables in InitializableAbstractStrategy.
    );
    const dVaultCore = await deployWithConfirmation(
      "VaultCore",
      undefined,
      undefined,
      true // Disable storage slot checking, we are renaming variables in InitializableAbstractStrategy.
    );

    log("Deployed VaultAdmin and VaultCore...");

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Deployer Actions
    // ----------------

    // 1. Deploy new implementation
    const dConvexStrategyImpl = await deployWithConfirmation(
      "ConvexStrategy",
      undefined,
      undefined,
      true // Disable storage slot checking, we are renaming variables in InitializableAbstractStrategy.
    );
    const dCompoundStrategyImpl = await deployWithConfirmation(
      "CompoundStrategy",
      undefined,
      undefined,
      true // Disable storage slot checking, we are renaming variables in InitializableAbstractStrategy.
    );
    const dAaveStrategyImpl = await deployWithConfirmation(
      "AaveStrategy",
      undefined,
      undefined,
      true // Disable storage slot checking, we are renaming variables in InitializableAbstractStrategy.
    );

    // CONVEX
    const cConvexStrategyProxy = await ethers.getContract(
      "ConvexStrategyProxy"
    );
    const cConvexStrategy = await ethers.getContractAt(
      "ConvexStrategy",
      cConvexStrategyProxy.address
    );
    log(
      "ConvexStrategyProxy proxyAddress:",
      cConvexStrategyProxy.address,
      " governor:",
      await cConvexStrategyProxy.governor()
    );

    // COMPOUND
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );

    const cCompoundStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      cCompoundStrategyProxy.address
    );
    log(
      "CompoundStrategyProxy proxyAddress:",
      cCompoundStrategyProxy.address,
      " governor:",
      await cCompoundStrategyProxy.governor()
    );

    // AAVE
    const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      cAaveStrategyProxy.address
    );
    log(
      "AaveStrategyProxy proxyAddress:",
      cAaveStrategyProxy.address,
      " governor:",
      await cAaveStrategyProxy.governor()
    );

    // Deploy new Harvester proxy
    const dHarvesterProxy = await deployWithConfirmation("HarvesterProxy");
    log(`Harvester proxy deployed at: ${dHarvesterProxy.address}`);

    const cHarvesterProxy = await ethers.getContractAt(
      "HarvesterProxy",
      dHarvesterProxy.address
    );
    const dHarvester = await deployWithConfirmation("Harvester", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);

    await withConfirmation(
      cHarvesterProxy.connect(sDeployer)[
        // eslint-disable-next-line
        "initialize(address,address,bytes)"
      ](dHarvester.address, deployerAddr, [])
    );

    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    const cGovernor = await ethers.getContract("Governor");
    await withConfirmation(
      cHarvester.connect(sDeployer).transferGovernance(cGovernor.address)
    );

    log("Initialized HarvesterProxy...");

    // Deploy OracleRouter
    await deployWithConfirmation("OracleRouter");
    const cOracleRouter = await ethers.getContract("OracleRouter");

    log("Oracle router deployed...");

    // Governance Actions
    // ----------------
    return {
      name: "Switch to multiple rewards token strategies for all strategies",
      actions: [
        // 1. Upgrade implementation Convex
        {
          contract: cConvexStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexStrategyImpl.address],
        },
        // 2. Use CRV as main rewards token and CVX as a secondary
        {
          contract: cConvexStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [[assetAddresses.CRV, assetAddresses.CVX]],
        },
        // 3. Upgrade implementation Compound
        {
          contract: cCompoundStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dCompoundStrategyImpl.address],
        },
        // 4. Set Compound reward token
        {
          contract: cCompoundStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [[assetAddresses.COMP]],
        },
        // 5. Upgrade implementation Aave
        {
          contract: cAaveStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dAaveStrategyImpl.address],
        },
        // 6. Set Aave reward token
        {
          contract: cAaveStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [[assetAddresses.AAVE_TOKEN]],
        },
        // 7. Set VaultCore implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 8. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 9. Set harvester address
        {
          contract: cCompoundStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 10. Set harvester address
        {
          contract: cAaveStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 11. Set harvester address
        {
          contract: cConvexStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 12. Claim governance
        {
          contract: cHarvester,
          signature: "claimGovernance()",
        },
        // 13. Set new oracle router as price provider
        {
          contract: cVaultAdmin,
          signature: "setPriceProvider(address)",
          args: [cOracleRouter.address],
        },
        // 14. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexStrategyProxy.address, true],
        },
        // 15. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cCompoundStrategyProxy.address, true],
        },
        // 16. Set supported strategy on Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAaveStrategyProxy.address, true],
        },
        // 17. Set reward token config
        {
          contract: cHarvester,
          // tokenAddress, allowedSlippageBps, harvestRewardBps, uniswapV2CompatibleAddr, liquidationLimit, doSwapRewardToken
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.CRV,
            300,
            100,
            assetAddresses.sushiswapRouter,
            MAX_UINT256,
            true,
          ],
        },
        // 18. Set reward token config
        {
          contract: cHarvester,
          // tokenAddress, allowedSlippageBps, harvestRewardBps, uniswapV2CompatibleAddr, liquidationLimit, doSwapRewardToken
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.CVX,
            300,
            100,
            assetAddresses.sushiswapRouter,
            MAX_UINT256,
            true,
          ],
        },
        // 19. Set reward token config
        {
          contract: cHarvester,
          // tokenAddress, allowedSlippageBps, harvestRewardBps, uniswapV2CompatibleAddr, liquidationLimit, doSwapRewardToken
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.COMP,
            300,
            100,
            assetAddresses.sushiswapRouter,
            MAX_UINT256,
            true,
          ],
        },
        // 20. Set reward token config
        {
          contract: cHarvester,
          // tokenAddress, allowedSlippageBps, harvestRewardBps, uniswapV2CompatibleAddr, liquidationLimit, doSwapRewardToken
          signature:
            "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
          args: [
            assetAddresses.AAVE,
            300,
            100,
            assetAddresses.sushiswapRouter,
            MAX_UINT256,
            true,
          ],
        },
        // 21. Set vault as rewards address
        {
          contract: cHarvester,
          signature: "setRewardsProceedsAddress(address)",
          args: [cVaultProxy.address],
        },
      ],
    };
  }
);
