const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "167_claim_CVX",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    return {
      name: `Claim CVX tokens stuck in the OUSD Vault.`,
      actions: [
        {
          contract: cVaultAdmin,
          signature: "transferToken(address,uint256)",
          args: [addresses.mainnet.CVX, "805679677566091469209"],
        },
      ],
    };
  }
);
