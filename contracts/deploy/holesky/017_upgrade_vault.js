const { parseEther } = require("ethers/lib/utils");

const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { getAssetAddresses } = require("../../test/helpers.js");
const { resolveContract } = require("../../utils/resolvers");

const mainExport = async () => {
  console.log("Running 017 deployment on Holesky...");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const assetAddresses = await getAssetAddresses();

  const cVaultProxy = await resolveContract("OETHVaultProxy");
  const cVault = await resolveContract("OETHVaultProxy", "IVault");
  const cDripper = await resolveContract("OETHDripperProxy", "OETHDripper");
  const strategyProxy = await resolveContract("NativeStakingSSVStrategyProxy");

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

  await withConfirmation(
    cVault.connect(sDeployer).setDripper(cDripper.address)
  );
  console.log(`Set Dripper to ${cDripper.address}`);

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setAssetDefaultStrategy(assetAddresses.WETH, strategyProxy.address)
  );
  console.log(`Set WETH default strategy to ${strategyProxy.address}`);

  await withConfirmation(
    cVault.connect(sDeployer).setVaultBuffer(parseEther("0.05"))
  );
  console.log(`Set vault buffer to 5%`);

  await withConfirmation(cVault.connect(sDeployer).allocate());
  console.log(`Allocated assets to strategy`);

  console.log("Running 017 deployment done");
  return true;
};

mainExport.id = "017_upgrade_vault";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
