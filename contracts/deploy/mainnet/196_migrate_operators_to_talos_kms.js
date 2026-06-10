const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

// the governor to execute this proposal is OGN governance
module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "196_migrate_operators_to_talos",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "22961702059927464053626280658057526947925126482574006865526656537485409437624",
  },
  async () => {
    // OUSD Vault (proxy "VaultProxy") + OETH Vault — IVault exposes both setters
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cVaultProxy.address
    );

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // Cross-chain strategies (same contract code, two Create2 proxies)
    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      addresses.mainnet.CrossChainMasterStrategy
    );
    const cCrossChainHyperEVMMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      addresses.mainnet.CrossChainHyperEVMMasterStrategy
    );

    return {
      name: "Migrate scheduled-action operator of the OUSD/OETH vaults and the Crosschain (Base + HyperEVM) strategies to the new signer, and unpause OUSD/OETH rebases.",
      actions: [
        {
          contract: cOUSDVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cOETHVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cCrossChainMasterStrategy,
          signature: "setOperator(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cCrossChainHyperEVMMasterStrategy,
          signature: "setOperator(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cOUSDVault,
          signature: "unpauseRebase()",
          args: [],
        },
        {
          contract: cOETHVault,
          signature: "unpauseRebase()",
          args: [],
        },
      ],
    };
  }
);
