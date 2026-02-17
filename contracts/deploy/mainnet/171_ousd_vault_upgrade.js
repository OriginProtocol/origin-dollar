const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "171_ousd_vault_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "54701237860996162345391578621003018342359490030642059972010789096768410041031",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OUSD Vault Core and Admin implementations
    const dVault = await deployWithConfirmation("OUSDVault", [
      addresses.mainnet.USDC,
    ]);

    // 2. Connect to the OUSD Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // 3. Connect to the Morpho OUSD v2 Strategy Proxy
    const cOUSDAMO = await ethers.getContract("OUSDCurveAMOProxy");
    const cMorphoStrategy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OUSD Vault to new Core and Admin implementations",
      actions: [
        // 1. Upgrade the OUSD Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVault.address],
        },
        // 2. Add OUSD/USDC AMO to mint whitelist
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOUSDAMO.address],
        },
        // 3. Set Morpho OUSD v2 Strategy as default strategy
        {
          contract: cVault,
          signature: "setDefaultStrategy(address)",
          args: [cMorphoStrategy.address],
        },
      ],
    };
  }
);
