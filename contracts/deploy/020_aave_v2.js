const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "020_aave_v2" },
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
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cOldAaveStrategy = await ethers.getContract("AaveStrategyProxy");
    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dAaveStrategyProxy = await deployWithConfirmation(
      "AaveStrategyProxy",
      [],
      "InitializeGovernedUpgradeabilityProxy"
    );
    const cAaveStrategyProxy = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      dAaveStrategyProxy.address
    );
    // 2. Deploy new implementation
    const dAaveStrategyImpl = await deployWithConfirmation("AaveStrategy");
    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      dAaveStrategyProxy.address
    );
    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cAaveStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dAaveStrategyImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );
    // 4. Init and configure new AAVE strategy
    const initFunction =
      "initialize(address,address,address,address[],address[],address,address)";
    await withConfirmation(
      cAaveStrategy
        .connect(sDeployer)
        [initFunction](
          assetAddresses.AAVE_ADDRESS_PROVIDER,
          cVaultAdmin.address,
          assetAddresses.AAVE,
          [assetAddresses.DAI],
          [assetAddresses.aDAI],
          assetAddresses.AAVE_INCENTIVES_CONTROLLER,
          assetAddresses.STKAAVE,
          await getTxOpts()
        )
    );
    // 5. Transfer governance
    await withConfirmation(
      cAaveStrategy
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------
    return {
      name: "Switch to new AAVEv2 strategy",
      actions: [
        // 1. Accept governance of new AAVEStrategy
        {
          contract: cAaveStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Remove old AAVE strategy from vault
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cOldAaveStrategy.address],
        },
        // 3. Add new AAVE v2 strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cAaveStrategy.address],
        },
      ],
    };
  }
);
