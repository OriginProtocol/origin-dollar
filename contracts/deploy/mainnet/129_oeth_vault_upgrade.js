const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "129_oeth_vault_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "88718652422371169609565969051527989757314494318421619545684851109270814057874",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    const dVaultCore = await deployWithConfirmation("OETHVaultCore", [
      addresses.mainnet.WETH,
    ]);
    const dVaultAdmin = await deployWithConfirmation("OETHVaultAdmin", [
      addresses.mainnet.WETH,
    ]);

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    const cCurveAMOStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to support multiple AMOs",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Add the Curve AMO as a whitelisted address
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cCurveAMOStrategyProxy.address],
        },
      ],
    };
  }
);
