const addresses = require("../utils/addresses");
const { oethPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "070_oeth_amo_upgrade",
    forceDeploy: false,
    deployerIsProposer: true,
  },
  async ({ ethers, deployWithConfirmation }) => {
    // STEP 1. Upgrade the OETH AMO strategy

    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    // Deploy and set the immutable variables for the new AMO strategy implementation
    const dConvexETHMetaStrategy = await deployWithConfirmation(
      "ConvexEthMetaStrategy",
      [
        [
          addresses.mainnet.CurveOETHMetaPool,
          addresses.mainnet.OETHVaultProxy,
          addresses.mainnet.CVXBooster,
          addresses.mainnet.OETHProxy,
          addresses.mainnet.CVXETHRewardsPool,
          addresses.mainnet.CurveOETHMetaPool,
          oethPoolLpPID,
          addresses.mainnet.WETH,
        ],
      ],
      null,
      true // force deploy as storage slots have changed
    );

    // STEP 2. Upgrade the OETH Vault

    // Deploy new Vault Admin
    const dVaultAdmin = await deployWithConfirmation("OETHVaultAdmin");

    // 2. Connect to the OETH Vault Proxy to the vault implementation
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH AMO strategy and OETH Vault.\n\
      \n\
      Code PR: #",
      actions: [
        // Upgrade the OETH AMO strategy proxy to the new strategy implementation
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexETHMetaStrategy.address],
        },
        // 2. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
      ],
    };
  }
);
