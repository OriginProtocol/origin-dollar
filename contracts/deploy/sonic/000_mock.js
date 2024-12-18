const { deployWithConfirmation } = require("../../utils/deploy");
const { isFork, isSonic } = require("../../test/helpers");

const deployMocks = async () => {
  await deployWithConfirmation("MockWS", []);
};

const deployCore = async () => {
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWS = await ethers.getContract("MockWS");

  // Proxies
  await deployWithConfirmation("OSonicProxy");
  await deployWithConfirmation("WOSonicProxy");
  await deployWithConfirmation("OSonicVaultProxy");

  const cOSonicProxy = await ethers.getContract("OSonicProxy");
  const cWOSonicProxy = await ethers.getContract("WSonicProxy");
  const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Core contracts
  const dOSonic = await deployWithConfirmation("OSonic");
  const dWOSonic = await deployWithConfirmation("WOSonic", [
    cOSonicProxy.address, // Base token
  ]);
  const dOSonicVault = await deployWithConfirmation("OSonicVault");
  const dOSonicVaultCore = await deployWithConfirmation("OSonicVaultCore", [
    cWS.address,
  ]);
  const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin");

  // Get contract instances
  const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);
  const cWOSonic = await ethers.getContractAt("WOSonic", cWOSonicProxy.address);
  const cOSonicVault = await ethers.getContractAt(
    "IVault",
    cOSonicVaultProxy.address
  );
  const cOracleRouter = await ethers.getContract("MockOracleRouter");

  // Init OSonic
  const resolution = ethers.utils.parseUnits("1", 27);
  const initDataOSonic = cOSonic.interface.encodeFunctionData(
    "initialize(string,string,address,uint256)",
    [
      "Origin S", // Token Name
      "OS", // Token Symbol
      cOSonicVaultProxy.address, // OETHb Vault
      resolution, // HighRes
    ]
  );
  // prettier-ignore
  await cOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonic.address,
      governorAddr,
      initDataOSonic
    );

  // Init OSonicVault
  const initDataOSonicVault = cOSonicVault.interface.encodeFunctionData(
    "initialize(address,address)",
    [
      cOracleRouter.address, // OracleRouter
      cOSonicProxy.address, // OETHb
    ]
  );
  // prettier-ignore
  await cOSonicVaultProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonicVault.address,
      governorAddr,
      initDataOSonicVault
    );

  // Init WOSonic
  const initDataWOSonic = cWOSonic.interface.encodeFunctionData(
    "initialize()",
    []
  );
  // prettier-ignore
  await cWOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dWOSonic.address,
      governorAddr,
      initDataWOSonic
    )

  await cOSonicVaultProxy
    .connect(sGovernor)
    .upgradeTo(dOSonicVaultCore.address);
  await cOSonicVault.connect(sGovernor).setAdminImpl(dOSonicVaultAdmin.address);

  await cOSonicVault.connect(sGovernor).supportAsset(cWS.address, 0);
  await cOSonicVault.connect(sGovernor).unpauseCapital();
};

const main = async () => {
  await deployMocks();
  await deployCore();
};

main.id = "000_mock";
main.tags = ["sonic_unit_tests"];

// Only run for unit tests
main.skip = () => isFork || isSonic;

module.exports = main;
