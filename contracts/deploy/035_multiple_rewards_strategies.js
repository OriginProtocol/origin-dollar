const { deploymentWithProposal, log } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "035_convex_rewards", forceDeploy: true },
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
    const dThreePoolStrategyImpl = await deployWithConfirmation(
      "ThreePoolStrategy",
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
    log("ConvexStrategyProxy proxyAddress:", cConvexStrategyProxy.address, " governor:", await cConvexStrategyProxy.governor());

    // COMPOUND
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );

    const cCompoundStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      cCompoundStrategyProxy.address
    );
    log("CompoundStrategyProxy proxyAddress:", cCompoundStrategyProxy.address, " governor:", await cCompoundStrategyProxy.governor());

    // AAVE
    const cAaveStrategyProxy = await ethers.getContract(
      "AaveStrategyProxy"
    );

    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      cAaveStrategyProxy.address
    );
    log("AaveStrategyProxy proxyAddress:", cAaveStrategyProxy.address, " governor:", await cAaveStrategyProxy.governor());

    // 3Pool
    const cThreePoolStrategyProxy = await ethers.getContract(
      "ThreePoolStrategyProxy"
    );

    const cThreePoolStrategy = await ethers.getContractAt(
      "ThreePoolStrategy",
      cThreePoolStrategyProxy.address
    );
    log("ThreePoolStrategyProxy proxyAddress:", cThreePoolStrategyProxy.address, " governor:", await cThreePoolStrategyProxy.governor());



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
          args: [[assetAddresses.AAVE]],
        },
        // 7. Upgrade implementation 3Pool
        {
          contract: cThreePoolStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dThreePoolStrategyImpl.address],
        },
        // 8. Set 3Pool reward token
        {
          contract: cThreePoolStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [[assetAddresses.CRV]],
        },
        {
          // Set VaultCore implementation
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        {
          // Set VaultAdmin implementation
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // TODO: add this once the Oracle is available
        // {
        //   // Add CVX as a swap token
        //   contract: cVault,
        //   signature: "addSwapToken(address)",
        //   args: [assetAddresses.CVX],
        // },
      ],
    };
  }
);
