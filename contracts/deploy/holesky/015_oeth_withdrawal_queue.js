const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");

const addresses = require("../../utils/addresses");

const mainExport = async () => {
  console.log("Running 015 deployment on Holesky...");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // 1. Deploy new OETH Vault Core and Admin implementations
  // Need to override the storage safety check as we are repacking the
  // internal assets mapping to just use 1 storage slot
  const dVaultCore = await deployWithConfirmation(
    "OETHVaultCore",
    [addresses.holesky.WETH],
    null,
    true
  );
  console.log(`OETHVaultCore deployed to ${dVaultCore.address}`);

  const dVaultAdmin = await deployWithConfirmation(
    "OETHVaultAdmin",
    [addresses.holesky.WETH],
    null,
    true
  );
  console.log(`OETHVaultAdmin deployed to ${dVaultAdmin.address}`);

  // 2. Connect to the OETH Vault as its governor via the proxy
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
  const cDripperProxy = await ethers.getContract("OETHDripperProxy");

  // 3. Execute the Governance actions
  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  await withConfirmation(
    cVault.connect(sGovernor).setDripper(cDripperProxy.address)
  );

  console.log("Running 015 deployment done");
  return true;
};

mainExport.id = "015_oeth_withdrawal_queue";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
