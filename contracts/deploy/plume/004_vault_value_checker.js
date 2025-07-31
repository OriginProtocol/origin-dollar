const { deployOnPlume } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnPlume(
  {
    deployName: "004_vault_value_checker",
  },
  async ({ ethers }) => {
    const OETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");
    const OETHp = await ethers.getContract("OETHPlumeProxy");

    const vaultValueChecker = await deployWithConfirmation(
      "VaultValueChecker",
      [OETHpVaultProxy.address, OETHp.address]
    );

    console.log("VaultValueChecker deployed at", vaultValueChecker.address);

    return {};
  }
);
