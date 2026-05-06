const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "049_permissioned_rebase_module",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    await deployWithConfirmation("PermissionedRebaseModule", [
      safeAddress,
      addresses.permissionedRebaseRelayer,
      [cOETHBaseVaultProxy.address],
    ]);
    const cPermissionedRebaseModule = await ethers.getContract(
      "PermissionedRebaseModule"
    );

    console.log(
      `PermissionedRebaseModule (for ${safeAddress}) deployed to`,
      cPermissionedRebaseModule.address
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
          .enableModule(cPermissionedRebaseModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);
