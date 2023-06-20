const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  {
    deployName: "065_upgrade_fraxeth_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: 53,
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cFraxETHStrategyProxy = await ethers.getContract(
      "FraxETHStrategyProxy"
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy new implementation
    const dFraxETHStrategyImpl = await deployWithConfirmation(
      "FraxETHStrategy"
    );
    const cFraxETHStrategyImpl = await ethers.getContractAt(
      "FraxETHStrategy",
      dFraxETHStrategyImpl.address
    );

    console.log(
      "New FraxETH Strategy implementation address: ",
      cFraxETHStrategyImpl.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Support WETH in FraxETH strategy",
      governorAddr: addresses.mainnet.OldTimelock,
      actions: [
        // 1. Upgrade to new implementation
        {
          contract: cFraxETHStrategyProxy,
          signature: "upgradeTo(address)",
          args: [cFraxETHStrategyImpl.address],
        },
      ],
    };
  }
);
