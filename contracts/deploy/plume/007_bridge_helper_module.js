const { deployOnPlume } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnPlume(
  {
    deployName: "007_bridge_helper_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    await deployWithConfirmation("PlumeBridgeHelperModule", [
      addresses.multichainStrategist,
    ]);
    const cPlumeBridgeHelperModule = await ethers.getContract(
      "PlumeBridgeHelperModule"
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(
        addresses.multichainStrategist
      );

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        addresses.multichainStrategist
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cPlumeBridgeHelperModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
