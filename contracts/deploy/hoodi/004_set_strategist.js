const addresses = require("../../utils/addresses.js");

const { withConfirmation } = require("../../utils/deploy");

const mainExport = async () => {
  console.log("Running 004_set_strategist deployment on Hoodi...");
  const { deployerAddr } = await getNamedAccounts();
  // deployer is govenor
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cVault = await ethers.getContractAt(
    "IVault",
    (
      await ethers.getContract("OETHVaultProxy")
    ).address
  );

  await withConfirmation(
    cVault
      .connect(sDeployer)
      .setStrategistAddr(addresses.hoodi.defenderRelayer)
  );

  console.log("004_set_strategist deploy done.");
  return true;
};

mainExport.id = "004_set_strategist";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
