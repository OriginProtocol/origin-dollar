const { deploymentWithProposal, log } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "035_convex_rewards", forceDeploy: false },
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
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dVaultCore = await deployWithConfirmation("VaultCore");
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

    // 3Pool
    const cThreePoolStrategyProxy = await ethers.getContract(
      "ThreePoolStrategyProxy"
    );

    const cThreePoolStrategy = await ethers.getContractAt(
      "ThreePoolStrategy",
      cThreePoolStrategyProxy.address
    );
    log(
      "ThreePoolStrategyProxy proxyAddress:",
      cThreePoolStrategyProxy.address,
      " governor:",
      await cThreePoolStrategyProxy.governor()
    );
    console.error("Debug A");
    // Harvester
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");

    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    console.error("Debug B");
    await withConfirmation(
      cHarvesterProxy.connect(sGovernor)[
        // eslint-disable-next-line
        "initialize(address,address,bytes)"
      ](cHarvester.address, deployerAddr, [])
    );

    console.error("Debug C");
    log("Initialized HarvesterProxy...");
    const initFunction = "initialize(address)";
    await withConfirmation(
      cHarvester
        .connect(sDeployer)
        // eslint-disable-next-line
        [initFunction](cVaultProxy.address, assetAddresses.USDT)
    );

    console.error("Debug Governance");
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
        {
          // 7. Set VaultCore implementation
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        {
          // 8. Set VaultAdmin implementation
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        {
          // 9. Add CVX as a swap token
          contract: cVault,
          signature: "addSwapToken(address)",
          args: [assetAddresses.CVX],
        },
        {
          // 10. Add harvester address
          contract: cVault,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // 11. Add harvester address
          contract: cCompoundStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // 12. Add harvester address
          contract: cAaveStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // 13. Add harvester address
          contract: cConvexStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        {
          // 14. Add harvester address
          contract: cCompoundStrategy,
          signature: "setHarvestRewardBps(address)",
          args: [100],
        },
        {
          // 15. Add harvester address
          contract: cAaveStrategy,
          signature: "setHarvestRewardBps(address)",
          args: [100],
        },
        {
          // 16. Add harvester address
          contract: cConvexStrategy,
          signature: "setHarvestRewardBps(address)",
          args: [100],
        },
      ],
    };
  }
);
