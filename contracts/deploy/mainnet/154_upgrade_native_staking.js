const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployCompoundingStakingSSVStrategy } = require("../deployActions");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "154_upgrade_native_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "99121594404373353367959271787303330322964429439529781330823574079193280812345",
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
      name: `Deploy new Compounding Staking Strategy that uses compounding validators and Beacon Chain merkle proofs`,
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
        // 4. set new Staking Strategy as the default strategy for WETH
        {
          contract: cVaultAdmin,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.WETH, cCompoundingStakingStrategy.address],
        },
      ],
    };
  }
);
