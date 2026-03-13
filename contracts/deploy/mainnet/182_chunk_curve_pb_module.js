const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../utils/hardhat-helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "182_chunk_curve_pb_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    const moduleName = "CurvePoolBoosterBribesModule";
    await deployWithConfirmation(
      moduleName,
      [
        safeAddress,
        addresses.mainnet.validatorRegistrator,
        [
          "0x2425ff98A23021BF056E96FB690BF49910a8cE49",
          "0x1A43D2F1bb24aC262D1d7ac05D16823E526FcA32",
          "0xDafF0D96037B0F7bf72C6e2b3125b5D19273B149",
          "0xc835BcA1378acb32C522f3831b8dba161a763FBE",
          "0xd5d46b7e8FF91C3227D2Cf0aAE263f87743e3340",
          "0xE9CA668D5C31Ea5162651667103537bDA5458500",
          "0x5400a839C198d787c784F370F5a27672285b2133",
          "0xAe6058D732f0f3E098A068A338dB07bbD5169d3D",
          "0x0a9Be4d89fFE3420ADf7e27c2DB14F789dd2aca8",
          "0xFc5fEF2D566f77262CeF4e86749fdF1170b6f63F",
        ],
        ethers.utils.parseEther("0.001"),
        1000000,
      ],
      "CurvePoolBoosterBribesModule",
      true
    );
    const cCurvePoolBoosterBribesModule = await ethers.getContract(moduleName);

    console.log(
      `${moduleName} (for ${safeAddress}) deployed to`,
      cCurvePoolBoosterBribesModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);
      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe
          .connect(safeSigner)
          .enableModule(cCurvePoolBoosterBribesModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
