const { deployWithConfirmation } = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");
const { isFork, oethUnits, isBase } = require("../../test/helpers");
const addresses = require("../../utils/addresses");

const deployMocks = async () => {
  await deployWithConfirmation("MockWETH", []);
  await deployWithConfirmation("MockAero", []);
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
  const dOETHb = await deployWithConfirmation("OETHBase");
  const dwOETHb = await deployWithConfirmation("WOETHBase", [
    cOETHbProxy.address, // Base token
  ]);
  const dOETHbVaultAdmin = await deployWithConfirmation("OETHBaseVault", [
    cWETH.address,
  ]);

  // Get contract instances
  const cOETHb = await ethers.getContractAt("OETHBase", cOETHbProxy.address);
  const cwOETHb = await ethers.getContractAt("WOETHBase", cwOETHbProxy.address);
  const cOETHbVault = await ethers.getContractAt(
    "IVault",
    cOETHbVaultProxy.address
  );

  // Init OETHb
  const resolution = ethers.utils.parseUnits("1", 27);
  const initDataOETHb = cOETHb.interface.encodeFunctionData(
    "initialize(address,uint256)",
    [
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
    "initialize(address)",
    [
      cOETHbProxy.address, // OETHb
    ]
  );
  // prettier-ignore
  await cOETHbVaultProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOETHbVaultAdmin.address,
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

  await cOETHbVaultProxy.connect(sGovernor).upgradeTo(dOETHbVaultAdmin.address);

  await cOETHbVault.connect(sGovernor).unpauseCapital();
};

const deployBridgedWOETHStrategy = async () => {
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const cWETH = await ethers.getContract("MockWETH");
  const cWOETHProxy = await ethers.getContract("BridgedBaseWOETHProxy");

  const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
  const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
  const cOETHbVault = await ethers.getContractAt(
    "IVault",
    cOETHbVaultProxy.address
  );

  await deployWithConfirmation("BridgedWOETHStrategyProxy");
  const cStrategyProxy = await ethers.getContract("BridgedWOETHStrategyProxy");

  const cOracleRouter = await ethers.getContract("MockOracleRouter");
  const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
    [addresses.zero, cOETHbVaultProxy.address],
    cWETH.address,
    cWOETHProxy.address,
    cOETHbProxy.address,
    cOracleRouter.address,
  ]);
  const cStrategy = await ethers.getContractAt(
    "BridgedWOETHStrategy",
    cStrategyProxy.address
  );

  // Init Strategy
  const initData = cStrategy.interface.encodeFunctionData(
    "initialize(uint128)",
    [
      100, // 1% maxPriceDiffBps
    ]
  );
  // prettier-ignore
  await cStrategyProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dStrategyImpl.address,
      governorAddr,
      initData
    )

  await cOETHbVault.connect(sGovernor).approveStrategy(cStrategyProxy.address);
  await cOETHbVault
    .connect(sGovernor)
    .addStrategyToMintWhitelist(cStrategyProxy.address);

  await cStrategy.connect(sGovernor).updateWOETHOraclePrice();
};

const main = async () => {
  await deployMocks();
  await deployWOETH();
  await deployOracleRouter();
  await deployCore();
  await deployBridgedWOETHStrategy();
};

main.id = "000_mock";
main.tags = ["base_unit_tests"];

// Only run for unit tests
main.skip = () => isFork || isBase;

module.exports = main;
