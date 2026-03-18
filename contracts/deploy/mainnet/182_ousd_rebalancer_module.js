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

    // TODO: After deployment, the Guardian Safe must call allowStrategy() for each
    // strategy the rebalancer is permitted to touch.
    // Submit a separate Safe transaction for:
    //   - addresses.mainnet.MorphoOUSDv2StrategyProxy  (Ethereum Morpho)
    //   - addresses.mainnet.CrossChainMasterStrategy   (Base Morpho master)

    return {
      actions: [],
    };
  }
);
