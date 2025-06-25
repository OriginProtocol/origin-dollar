const { deployOnBase } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "033_bridge_helper_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    await deployWithConfirmation("BaseBridgeHelperModule", [
      addresses.multichainStrategist,
    ]);
    const cBaseBridgeHelperModule = await ethers.getContract(
      "BaseBridgeHelperModule"
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
        cSafe.connect(safeSigner).enableModule(cBaseBridgeHelperModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
