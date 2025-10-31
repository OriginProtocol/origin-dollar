const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { getAssetAddresses } = require("../../test/helpers.js");
const { resolveContract } = require("../../utils/resolvers");
const { getDefenderSigner } = require("../../utils/signersNoHardhat.js");

const mainExport = async () => {
  console.log("Running 005_upgrade_vault deployment on Hoodi...");
  // Governor is the Defender Relayer
  const sDeployer = await getDefenderSigner();
  const assetAddresses = await getAssetAddresses();

  const cVaultProxy = await resolveContract("OETHVaultProxy");
  const cVault = await resolveContract("OETHVaultProxy", "IVault");

  const dOETHVaultCore = await deployWithConfirmation("OETHVaultCore", [
    assetAddresses.WETH,
  ]);
  console.log(`Deployed OETHVaultCore to ${dOETHVaultCore.address}`);

  const dOETHVaultAdmin = await deployWithConfirmation("OETHVaultAdmin", [
    assetAddresses.WETH,
  ]);
  console.log(`Deployed OETHVaultAdmin to ${dOETHVaultAdmin.address}`);

  await withConfirmation(
    cVaultProxy.connect(sDeployer).upgradeTo(dOETHVaultCore.address)
  );
  console.log(`Upgraded OETHVaultCore to ${dOETHVaultCore.address}`);

  await withConfirmation(
    cVault.connect(sDeployer).setAdminImpl(dOETHVaultAdmin.address)
  );
  console.log(`Set OETHVaultAdmin to ${dOETHVaultAdmin.address}`);

  console.log("005_upgrade_vault deploy done.");
  return true;
};

mainExport.id = "005_upgrade_vault";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
