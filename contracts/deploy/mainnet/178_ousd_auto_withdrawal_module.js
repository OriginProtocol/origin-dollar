const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "178_ousd_auto_withdrawal_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const safeAddress = addresses.multichainStrategist;

    const cStrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );
    const cVaultProxy = await ethers.getContract("VaultProxy");

    await deployWithConfirmation("AutoWithdrawalModule", [
      safeAddress,
      // Defender relayer
      addresses.mainnet.validatorRegistrator,
      cVaultProxy.address,
      cStrategyProxy.address,
    ]);
    const cAutoWithdrawalModule = await ethers.getContract(
      "AutoWithdrawalModule"
    );
    console.log(
      `AutoWithdrawalModule deployed to ${cAutoWithdrawalModule.address}`
    );

    return {
      actions: [],
    };
  }
);
