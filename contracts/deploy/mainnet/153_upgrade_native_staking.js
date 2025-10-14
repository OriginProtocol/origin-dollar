const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployCompoundingStakingSSVStrategy } = require("../deployActions");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "153_upgrade_native_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );
    // Deployer Actions
    // ----------------

    // 1. Deploy the new Compounding Staking Strategy contracts
    const cCompoundingStakingStrategy =
      await deployCompoundingStakingSSVStrategy();

    // Governance Actions
    // ----------------
    return {
      name: `Deploy new Compounding Staking Strategy that uses compounding validators`,
      actions: [
        // 1. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cCompoundingStakingStrategy.address],
        },
        // 2. set harvester to the Defender Relayer
        {
          contract: cCompoundingStakingStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 3. set validator registrator to the Defender Relayer
        {
          contract: cCompoundingStakingStrategy,
          signature: "setRegistrator(address)",
          // The Defender Relayer
          args: [addresses.mainnet.validatorRegistrator],
        },
      ],
    };
  }
);
