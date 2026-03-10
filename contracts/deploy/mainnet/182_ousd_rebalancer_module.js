const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "182_ousd_rebalancer_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const safeAddress = addresses.multichainStrategist;

    const cVaultProxy = await ethers.getContract("VaultProxy");

    await deployWithConfirmation("RebalancerModule", [
      safeAddress,
      // Defender relayer
      addresses.mainnet.validatorRegistrator,
      cVaultProxy.address,
    ]);
    const cRebalancerModule = await ethers.getContract("RebalancerModule");
    console.log(`RebalancerModule deployed to ${cRebalancerModule.address}`);

    return {
      actions: [],
    };
  }
);
