const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "076_upgrade_fraxeth_strategy",
    forceDeploy: false,
    forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: true,
    // proposalId: "",
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
      "FraxETHStrategy",
      [
        [addresses.mainnet.sfrxETH, addresses.mainnet.OETHVaultProxy],
        addresses.mainnet.frxETH,
      ],
      undefined,
      true
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
      name: "Upgrade FraxETH strategy so it can withdrawAll with no assets",
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
