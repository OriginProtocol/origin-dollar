const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "044_bridge_helper_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    await deployWithConfirmation("BaseBridgeHelperModule", [safeAddress]);
    const cBridgeHelperModule = await ethers.getContract(
      "BaseBridgeHelperModule"
    );

    console.log(
      `BaseBridgeHelperModule (for ${safeAddress}) deployed to`,
      cBridgeHelperModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cBridgeHelperModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
