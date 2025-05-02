const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { isFork } = require("../../test/helpers");
const { impersonateAccount } = require("../../utils/signers");
const { getStorageAt } = require("@nomicfoundation/hardhat-network-helpers");

module.exports = deployOnPlume(
  { deployName: "004_temp_safe_module" },
  async ({ ethers }) => {
    await deployWithConfirmation("TempPlumeSafeModule");
    const cSafeTempModule = await ethers.getContract("TempPlumeSafeModule");
    console.log("TempPlumeSafeModule deployed at", cSafeTempModule.address);

    if (isFork) {
      const treasurySafe = "0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc";
      const treasurySafeSigner = await impersonateAccount(treasurySafe);

      const cTreasurySafe = await ethers.getContractAt(
        [
          "function enableModule(address) external",
          "function disableModule(address,address) external",
          "function execTransactionFromModule(address,uint256,bytes memory,uint8) external returns(bool)",
        ],
        treasurySafe
      );

      let singletonBefore = await getStorageAt(
        cTreasurySafe.address,
        0, // Slot 0
        "latest"
      );
      singletonBefore = ethers.utils.defaultAbiCoder.decode(
        ["address"],
        singletonBefore
      );
      console.log("Singleton Before update", singletonBefore);

      await withConfirmation(
        cTreasurySafe
          .connect(treasurySafeSigner)
          .enableModule(cSafeTempModule.address)
      );
      console.log("Enabled module");

      await withConfirmation(cSafeTempModule.execFixSingleton());

      console.log("Executed fixSingleton");

      console.log("Changed singleton, current storage state:");

      let singleton = await getStorageAt(
        cTreasurySafe.address,
        0, // Slot 0
        "latest"
      );
      singleton = ethers.utils.defaultAbiCoder.decode(["address"], singleton);
      console.log("Singleton", singleton);

      if (singleton == singletonBefore) {
        throw new Error("Singleton did not change");
      } else {
        console.log("Singleton Changed");
      }
    }

    return {};
  }
);
