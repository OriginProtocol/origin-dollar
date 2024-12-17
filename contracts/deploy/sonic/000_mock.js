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

  const cOETHbProxy = await ethers.getContract("OSonicProxy");
  const cwOETHbProxy = await ethers.getContract("WSonicProxy");
  const cOETHbVaultProxy = await ethers.getContract("OSonicVaultProxy");

  // Core contracts
  const dOETHb = await deployWithConfirmation("OSonic");
  const dwOETHb = await deployWithConfirmation("WOSonic", [
    cOETHbProxy.address, // Base token
  ]);
  const dOETHbVault = await deployWithConfirmation("OSonicVault");
  const dOETHbVaultCore = await deployWithConfirmation("OSonicVaultCore", [
    cWS.address,
  ]);
  const dOETHbVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin");

  // Get contract instances
  const cOETHb = await ethers.getContractAt("OSonic", cOETHbProxy.address);
  const cwOETHb = await ethers.getContractAt("WOSonic", cwOETHbProxy.address);
  const cOETHbVault = await ethers.getContractAt(
    "IVault",
    cOETHbVaultProxy.address
  );
  const cOracleRouter = await ethers.getContract("MockOracleRouter");

  // Init OETHb
  const resolution = ethers.utils.parseUnits("1", 27);
  const initDataOETHb = cOETHb.interface.encodeFunctionData(
    "initialize(string,string,address,uint256)",
    [
      "Origin S", // Token Name
      "OS", // Token Symbol
      cOETHbVaultProxy.address, // OETHb Vault
      resolution, // HighRes
    ]
  );
  // prettier-ignore
  await cOETHbProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOETHb.address,
      governorAddr,
      initDataOETHb
    );

  // Init OETHbVault
  const initDataOETHbVault = cOETHbVault.interface.encodeFunctionData(
    "initialize(address,address)",
    [
      cOracleRouter.address, // OracleRouter
      cOETHbProxy.address, // OETHb
    ]
  );
  // prettier-ignore
  await cOETHbVaultProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOETHbVault.address,
      governorAddr,
      initDataOETHbVault
    );

  // Init wOETHb
  const initDatawOETHb = cwOETHb.interface.encodeFunctionData(
    "initialize()",
    []
  );
  // prettier-ignore
  await cwOETHbProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dwOETHb.address,
      governorAddr,
      initDatawOETHb
    )

  await cOETHbVaultProxy.connect(sGovernor).upgradeTo(dOETHbVaultCore.address);
  await cOETHbVault.connect(sGovernor).setAdminImpl(dOETHbVaultAdmin.address);

  await cOETHbVault.connect(sGovernor).supportAsset(cWS.address, 0);
  await cOETHbVault.connect(sGovernor).unpauseCapital();
};

const main = async () => {
  await deployMocks();
  // await deployOracleRouter();
  await deployCore();
};

main.id = "000_mock";
main.tags = ["base_unit_tests"];

// Only run for unit tests
main.skip = () => isFork || isSonic;

module.exports = main;
