const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "169_improve_curve_pb_module",
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
          "0xFc87E0ABe3592945Ad7587F99161dBb340faa767",
          "0x1A43D2F1bb24aC262D1d7ac05D16823E526FcA32",
          "0x028C6f98C20094367F7b048F0aFA1E11ce0A8DBd",
          "0xc835BcA1378acb32C522f3831b8dba161a763FBE",
        ],
        ethers.utils.parseEther("0.001"), // Bridge fee
        1000000, // Additional gas limit for cross-chain execution
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
