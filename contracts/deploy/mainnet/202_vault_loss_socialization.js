const addresses = require("../../utils/addresses");
const { parseUnits } = require("ethers/lib/utils");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

// Backing-ratio circuit breaker (`maxSupplyDiff`) is re-interpreted by this
// upgrade as the maximum loss the vault auto-socialises before the fuse trips.
// Set it wide so ordinary depegs socialise and claims keep flowing; a larger
// loss trips it and governance intervenes.
// NOTE: confirm these policy values with governance before submitting.
const MAX_SUPPLY_DIFF = parseUnits("0.2", 18); // 20%
// Block user mints once the vault is under-backed by more than this. Kept tight.
const MINT_TOLERANCE = parseUnits("0.01", 18); // 1%

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "202_vault_loss_socialization",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId is generated on first run; fill in after proposing.
  },
  async ({ deployWithConfirmation }) => {
    // 1. Deploy new OUSD Vault implementation
    const dOUSDVault = await deployWithConfirmation(
      "OUSDVault",
      [addresses.mainnet.USDC],
      undefined,
      true
    );

    // 2. Deploy new OETH Vault implementation
    const dOETHVault = await deployWithConfirmation(
      "OETHVault",
      [addresses.mainnet.WETH],
      undefined,
      true
    );

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

    return {
      name: "Socialise withdrawal-queue losses on the OUSD and OETH vaults",
      actions: [
        // OUSD vault
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDVault.address],
        },
        {
          contract: cOUSDVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [MAX_SUPPLY_DIFF],
        },
        {
          contract: cOUSDVault,
          signature: "setMintTolerance(uint256)",
          args: [MINT_TOLERANCE],
        },
        // OETH vault
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVault.address],
        },
        {
          contract: cOETHVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [MAX_SUPPLY_DIFF],
        },
        {
          contract: cOETHVault,
          signature: "setMintTolerance(uint256)",
          args: [MINT_TOLERANCE],
        },
      ],
    };
  }
);
