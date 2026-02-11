const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "164_fix_curve_pb_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    const moduleName = `CurvePoolBoosterBribesModule`;
    await deployWithConfirmation(
      moduleName,
      [
        safeAddress,
        // Defender Relayer
        addresses.mainnet.validatorRegistrator,
        [
          "0x7B5e7aDEBC2da89912BffE55c86675CeCE59803E",
          "0x514447A1Ef103f3cF4B0fE92A947F071239f2809",
        ],
      ],
      "CurvePoolBoosterBribesModule"
    );
    const cCurvePoolBoosterBribesModule = await ethers.getContract(moduleName);

    console.log(
      `${moduleName} (for ${safeAddress}) deployed to`,
      cCurvePoolBoosterBribesModule.address
    );

    return {
      actions: [],
    };
  }
);
