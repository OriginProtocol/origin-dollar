const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "020_aave_v2" },
  async ({ ethers, deployWithConfirmation }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    // Signers
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
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
    // 2. Deploy new implimentation
    await deployWithConfirmation("AaveStrategy");
    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      dAaveStrategyProxy.address
    );
    // 3. Init and configure new AAVE strategy
    const initFunction =
      "initialize(address,address,address,address[],address[],address,address)";
    await withConfirmation(
      cAaveStrategy.connect(sDeployer)[initFunction](
        assetAddresses.AAVE_ADDRESS_PROVIDER, // TODO Check
        cVaultProxy.address,
        assetAddresses.AAVE_TOKEN, // TODO
        [assetAddresses.DAI],
        [assetAddresses.aDAI],
        assetAddresses.AAVE_INCENTIVES_CONTROLLER, // TODO
        assetAddresses.STKAAVE // TODO
      )
    );
    // 4. Transfer governance
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
          contract: cVaultProxy,
          signature: "removeStrategy(address)",
          args: [cOldAaveStrategy.address],
        },
        // 3. Add new AAVE v2 strategy to vault
        {
          contract: cVaultProxy,
          signature: "approveStrategy(address)",
          args: [cAaveStrategy.address],
        },
      ],
    };
  }
);
