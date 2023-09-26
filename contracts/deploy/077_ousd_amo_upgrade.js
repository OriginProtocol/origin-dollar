const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "077_ousd_amo_upgrade",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    // 1. Deploy new OUSD Vault Core and Admin implementations
    // Need to override the storage safety check as we are changing the Strategy struct
    const dVaultCore = await deployWithConfirmation(
      "VaultCore",
      [],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "VaultAdmin",
      [],
      null,
      true
    );

    // Connect to the OUSD Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OUSD AMO strategy.",
      actions: [
        // 1. Upgrade the OUSD Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OUSD Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Flag the existing AMO strategy for Curve OUSD/3CRV pool to be an AMO in the OUSD Vault
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [addresses.mainnet.ConvexOUSDAMOStrategy, true],
        },
        // 4. Reset the mint threshold for the old AMO strategy as its storage has changed to 50m
        {
          contract: cVault,
          signature: "setMintForStrategyThreshold(address,uint256)",
          args: [
            addresses.mainnet.ConvexOUSDAMOStrategy,
            parseUnits("50", 24),
          ],
        },
      ],
    };
  }
);
