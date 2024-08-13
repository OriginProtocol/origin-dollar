const { deployWithConfirmation } = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");
const { isFork, oethUnits } = require("../../test/helpers");

const deployMocks = async () => {
  await deployWithConfirmation("MockWETH", []);
};

const deployWOETH = async () => {
  const { governorAddr } = await getNamedAccounts();

  // Deploy proxy
  await deployWithConfirmation("BridgedBaseWOETHProxy", []);
  const cWOETHProxy = await ethers.getContract("BridgedBaseWOETHProxy");

  // Deploy Bridged WOETH Token implementation
  await deployWithConfirmation("BridgedWOETH", []);
  const cWOETHImpl = await ethers.getContract("BridgedWOETH");

  // Initialize the proxy
  // prettier-ignore
  await cWOETHProxy["initialize(address,address,bytes)"](
      cWOETHImpl.address,
      governorAddr,
      "0x",
      await getTxOpts()
    );

  // Initialize implementation
  const cWOETH = await ethers.getContractAt(
    "BridgedWOETH",
    cWOETHProxy.address
  );
  await cWOETH.initialize();
};

const deployOracleRouter = async () => {
  const cWOETHProxy = await ethers.getContract("BridgedBaseWOETHProxy");
  const cWETH = await ethers.getContract("MockWETH");

  await deployWithConfirmation("MockOracleRouter");
  const cOracleRouter = await ethers.getContract("MockOracleRouter");

  const wethFeed = await deployWithConfirmation(
    "MockPriceFeedWETH",
    [oethUnits("1"), 18],
    "MockChainlinkOracleFeed"
  );
  const woethFeed = await deployWithConfirmation(
    "MockPriceFeedWOETH",
    [oethUnits("1.01"), 18],
    "MockChainlinkOracleFeed"
  );

  await cOracleRouter.setFeed(cWETH.address, wethFeed.address, 24 * 60 * 60);
  await cOracleRouter.setFeed(
    cWOETHProxy.address,
    woethFeed.address,
    24 * 60 * 60
  );
};

const deployCore = async () => {
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWETH = await ethers.getContract("MockWETH");

  // Proxies
  await deployWithConfirmation("OETHBaseProxy");
  await deployWithConfirmation("WOETHBaseProxy");
  await deployWithConfirmation("OETHBaseVaultProxy");

  const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
  const cwOETHbProxy = await ethers.getContract("WOETHBaseProxy");
  const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

  // Core contracts
  const dOETHb = await deployWithConfirmation("OETH");
  const dwOETHb = await deployWithConfirmation("WOETHBase", [
    cOETHbProxy.address, // Base token
    "Wrapped OETH Base",
    "wOETHb",
  ]);
  const dOETHbVault = await deployWithConfirmation("OETHVault");
  const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
    cWETH.address,
  ]);
  const dOETHbVaultAdmin = await deployWithConfirmation("OETHBaseVaultAdmin");

  // Get contract instances
  const cOETHb = await ethers.getContractAt("OETH", cOETHbProxy.address);
  const cwOETHb = await ethers.getContractAt("WOETHBase", cwOETHbProxy.address);
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
      "OETH Base",
      "OETHb", // Token Symbol
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

  await cOETHbVault.connect(sGovernor).supportAsset(cWETH.address, 0);
  await cOETHbVault.connect(sGovernor).unpauseCapital();
};

const main = async () => {
  await deployMocks();
  await deployWOETH();
  await deployOracleRouter();
  await deployCore();
};

main.id = "000_mock";
main.tags = ["base_unit_tests"];

// Only run for unit tests
main.skip = () => isFork;

module.exports = main;
