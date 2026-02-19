const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "178_claim_CVX",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "57581469695523133024511182636369891884849435427610817026787152366134160238232",
  },
  async () => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cCVX = await ethers.getContractAt("ERC20", addresses.mainnet.CVX);

    return {
      name: `Claim CVX tokens stuck in the OUSD Vault.`,
      actions: [
        {
          contract: cVaultAdmin,
          signature: "transferToken(address,uint256)",
          args: [addresses.mainnet.CVX, "805679677566091469209"],
        },
        {
          contract: cCVX,
          signature: "transfer(address,uint256)",
          args: [addresses.multichainStrategist, "805679677566091469209"],
        },
      ],
    };
  }
);
