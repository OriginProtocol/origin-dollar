const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "179_upgrade_ousd_morpho_v2_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "38234265178409078333598297388552567945868201345097914935151040432111128029390",
  },
  async ({ deployWithConfirmation }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDMorphoV2StrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    const dMorphoV2StrategyImpl = await deployWithConfirmation(
      "MorphoV2Strategy",
      [
        [addresses.mainnet.MorphoOUSDv2Vault, cVaultProxy.address],
        addresses.mainnet.USDC,
      ]
    );

    const cMorphoV2Strategy = await ethers.getContractAt(
      "MorphoV2Strategy",
      cOUSDMorphoV2StrategyProxy.address
    );

    return {
      name: "Upgrade OUSD Morpho V2 strategy implementation",
      actions: [
        {
          contract: cOUSDMorphoV2StrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMorphoV2StrategyImpl.address],
        },
        {
          contract: cMorphoV2Strategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
