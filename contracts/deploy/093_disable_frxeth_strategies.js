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
      "44277089853749395103495090988298299772264220800986246762669183539782770414789",
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
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.frxETH, addresses.zero],
        },
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
