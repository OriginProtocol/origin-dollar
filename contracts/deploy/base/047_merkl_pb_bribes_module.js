const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "047_merkl_pb_bribes_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    await deployWithConfirmation("MerklPoolBoosterBribesModule", [
      safeAddress,
      addresses.base.OZRelayerAddress,
      "0x9D7bdc2Ead55c6c460dFCBccC315dC4f6C6c1bF9", // PoolBoosterFactoryMerkl base
    ]);
    const cMerklModule = await ethers.getContract(
      "MerklPoolBoosterBribesModule"
    );

    console.log(
      `MerklPoolBoosterBribesModule (for ${safeAddress}) deployed to`,
      cMerklModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);
      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cMerklModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
