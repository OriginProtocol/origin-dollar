const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "090_disable_compound",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "540302155888465131843465904203767906417865895567367577074989857543481682425",
  },
  async ({ ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Remove Morpho Compound Strategy from OUSD",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [addresses.mainnet.MorphoStrategyProxy],
        },
      ],
    };
  }
);
