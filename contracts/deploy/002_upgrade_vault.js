const hre = require("hardhat");
const { utils } = require("ethers");
const { isMainnet, isRinkeby, isFork } = require("../test/helpers.js");
const { deployWithConfirmation } = require("../utils/deploy");

const addresses = require("../utils/addresses");

const upgradeVaultCoreAndAdmin = async ({ getNamedAccounts }) => {
  console.log("Running 002_vault_upgrade deployment...");

  const { governorAddr } = await getNamedAccounts();
  console.log(governorAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault core contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  console.log("Deployed VaultCore");
  // Deploy a new vault admin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
  console.log("Deployed VaultAdmin");

  if (isMainnet) {
    // The upgrade on Mainnet has to be handled manually since it involves a multi-sig tx.
    console.log(
      "Next step: submit a governance proposal on Mainnet to perform the upgrade."
    );
  } else if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    const binanceSigner = await ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governorAddr],
    });
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    await cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address);
    console.log("Upgraded VaultCore implementation to", dVaultCore.address);
    await cVaultCoreProxy.connect(sGovernor).setAdminImpl(dVaultAdmin.address);
    console.log("Upgraded VaultAdmin implementation to", dVaultAdmin.address);
  }

  return true;
};

upgradeVaultCoreAndAdmin.id = "002_upgrade_vault";
upgradeVaultCoreAndAdmin.dependencies = ["core"];
upgradeVaultCoreAndAdmin.skip = () => !(isMainnet || isRinkeby || isFork);

module.exports = upgradeVaultCoreAndAdmin;
