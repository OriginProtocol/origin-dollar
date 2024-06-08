const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "098_remove_reth_strategy",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Remove rETH Balancer Strategy",
      actions: [
        {
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.rETH, addresses.zero],
        },
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [addresses.mainnet.BalancerRETHStrategy],
        },
      ],
    };
  }
);
