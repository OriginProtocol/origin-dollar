const { deploymentWithProposal, log } = require("../utils/deploy");
const { MAX_UINT256 } = require("../utils/constants");

module.exports = deploymentWithProposal(
  { deployName: "038_multiple_rewards_public_harvest", forceDeploy: true },
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
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade vault for better error reporting",
      actions: [
        // 1. Set VaultCore implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
      ],
    };
  }
);
