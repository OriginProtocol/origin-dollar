const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "093_disable_frxeth_strategies",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "83580898965808725375888139100046802775881006834154592210638204262085739243220",
  },
  async ({ ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Remove OETH frxETH Strategies",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [addresses.mainnet.FraxETHStrategy],
        },
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [addresses.mainnet.FraxETHRedeemStrategy],
        },
      ],
    };
  }
);
