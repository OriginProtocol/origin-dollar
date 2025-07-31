const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isBaseFork, oethUnits } = require("./helpers");
const { impersonateAndFund, impersonateAccount } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const { deployWithConfirmation } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const erc20Abi = require("./abi/erc20.json");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("test:fixtures-base");

const aeroSwapRouterAbi = require("./abi/aerodromeSwapRouter.json");
const aeroNonfungiblePositionManagerAbi = require("./abi/aerodromeNonfungiblePositionManager.json");
const aerodromeSugarAbi = require("./abi/aerodromeSugarHelper.json");
const curveXChainLiquidityGaugeAbi = require("./abi/curveXChainLiquidityGauge.json");
const curveStableSwapNGAbi = require("./abi/curveStableSwapNG.json");
const curveChildLiquidityGaugeFactoryAbi = require("./abi/curveChildLiquidityGaugeFactory.json");

const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const BURNER_ROLE =
  "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";

let snapshotId;

const baseFixtureWithMockedVaultAdminConfig = async () => {
  const fixture = await defaultFixture();

  const cOETHVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
  const cOETHVaultAdmin = await ethers.getContractAt(
    "IVault",
    cOETHVaultProxy.address
  );
  await deployWithConfirmation("MockOETHVaultAdmin", [fixture.weth.address]);

  const mockVaultAdmin = await ethers.getContract("MockOETHVaultAdmin");
  await cOETHVaultAdmin
    .connect(fixture.governor)
    .setAdminImpl(mockVaultAdmin.address);

  fixture.oethbVault = await ethers.getContractAt(
    "IMockVault",
    fixture.oethbVault.address
  );
  return fixture;
};

const defaultFixture = async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isBaseFork && isFork) {
    // Only works for Base fork
    return;
  }

  if (isFork) {
    // Fund deployer account
    const { deployerAddr } = await getNamedAccounts();
    await impersonateAndFund(deployerAddr);
  }

  log(
    `Before deployments with param "${isFork ? ["base"] : ["base_unit_tests"]}"`
  );

  // Run the contract deployments
  await deployments.fixture(isFork ? ["base"] : ["base_unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  // OETHb
  const oethbProxy = await ethers.getContract("OETHBaseProxy");
  const oethb = await ethers.getContractAt("OETH", oethbProxy.address);

  // wOETHb (4626)
  const wOETHbProxy = await ethers.getContract("WOETHBaseProxy");
  const wOETHb = await ethers.getContractAt("WOETHBase", wOETHbProxy.address);

  // OETHb Vault
  const oethbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
  const oethbVault = await ethers.getContractAt(
    "IVault",
    oethbVaultProxy.address
  );

  let aerodromeAmoStrategy, dripper, harvester, quoter, sugar, curveAMOStrategy;
  if (isFork) {
    // Aerodrome AMO Strategy
    const aerodromeAmoStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    aerodromeAmoStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      aerodromeAmoStrategyProxy.address
    );

    // Harvester
    const harvesterProxy = await ethers.getContract("OETHBaseHarvesterProxy");
    harvester = await ethers.getContractAt(
      "SuperOETHHarvester",
      harvesterProxy.address
    );

    // Sugar Helper
    sugar = await ethers.getContractAt(
      aerodromeSugarAbi,
      addresses.base.sugarHelper
    );

    await deployWithConfirmation("AerodromeAMOQuoter", [
      aerodromeAmoStrategy.address,
      addresses.base.aeroQuoterV2Address,
    ]);

    quoter = await hre.ethers.getContract("AerodromeAMOQuoter");

    // Dripper
    const dripperProxy = await ethers.getContract("OETHBaseDripperProxy");
    dripper = await ethers.getContractAt(
      "FixedRateDripper",
      dripperProxy.address
    );

    const curveAMOProxy = await ethers.getContract("OETHBaseCurveAMOProxy");
    curveAMOStrategy = await ethers.getContractAt(
      "BaseCurveAMOStrategy",
      curveAMOProxy.address
    );
  }

  // Bridged wOETH
  const woethProxy = await ethers.getContract("BridgedBaseWOETHProxy");
  const woeth = await ethers.getContractAt("BridgedWOETH", woethProxy.address);

  const woethStrategyProxy = await ethers.getContract(
    "BridgedWOETHStrategyProxy"
  );
  const woethStrategy = await ethers.getContractAt(
    "BridgedWOETHStrategy",
    woethStrategyProxy.address
  );

  const oracleRouter = await ethers.getContract(
    isFork ? "OETHBaseOracleRouter" : "MockOracleRouter"
  );

  // WETH
  let weth, aero;

  if (isFork) {
    weth = await ethers.getContractAt("IWETH9", addresses.base.WETH);
    aero = await ethers.getContractAt(erc20Abi, addresses.base.AERO);
  } else {
    weth = await ethers.getContract("MockWETH");
    aero = await ethers.getContract("MockAero");
  }

  // Zapper
  const zapper = !isFork
    ? undefined
    : await ethers.getContract("OETHBaseZapper");

  const signers = await hre.ethers.getSigners();

  const [minter, burner, rafael, nick, clement] = signers.slice(4); // Skip first 4 addresses to avoid conflict
  const { governorAddr, multichainStrategistAddr, timelockAddr } =
    await getNamedAccounts();
  const governor = await ethers.getSigner(isFork ? timelockAddr : governorAddr);
  await hhHelpers.setBalance(governorAddr, oethUnits("1")); // Fund governor with some ETH

  const guardian = await ethers.getSigner(governorAddr);
  const timelock = await ethers.getContractAt(
    "ITimelockController",
    timelockAddr
  );
  const oethVaultSigner = await impersonateAccount(oethbVault.address);

  let strategist;
  if (isFork) {
    // Impersonate strategist on Fork
    strategist = await impersonateAndFund(multichainStrategistAddr);
    strategist.address = multichainStrategistAddr;

    await impersonateAndFund(governor.address);
    await impersonateAndFund(timelock.address);

    // configure Vault to not automatically deposit to strategy
    await oethbVault.connect(governor).setVaultBuffer(oethUnits("1"));
  }

  // Make sure we can print bridged WOETH for tests
  await woeth.connect(governor).grantRole(MINTER_ROLE, minter.address);
  await woeth.connect(governor).grantRole(BURNER_ROLE, burner.address);

  for (const user of [rafael, nick, clement]) {
    // Mint some bridged WOETH
    await woeth.connect(minter).mint(user.address, oethUnits("1"));
    await hhHelpers.setBalance(user.address, oethUnits("100000000"));
    await weth.connect(user).deposit({ value: oethUnits("10000000") });

    // Set allowance on the vault
    await weth.connect(user).approve(oethbVault.address, oethUnits("5000"));
  }

  await woeth.connect(minter).mint(governor.address, oethUnits("1"));

  if (isFork) {
    // Governor opts in for rebasing
    await oethb.connect(governor).rebaseOptIn();
  }

  const aeroSwapRouter = await ethers.getContractAt(
    aeroSwapRouterAbi,
    addresses.base.swapRouter
  );
  const aeroClGauge = await ethers.getContractAt(
    "ICLGauge",
    addresses.base.aerodromeOETHbWETHClGauge
  );
  const aeroNftManager = await ethers.getContractAt(
    aeroNonfungiblePositionManagerAbi,
    addresses.base.nonFungiblePositionManager
  );

  const curvePoolOEthbWeth = await ethers.getContractAt(
    curveStableSwapNGAbi,
    addresses.base.OETHb_WETH.pool
  );

  const curveGaugeOETHbWETH = await ethers.getContractAt(
    curveXChainLiquidityGaugeAbi,
    addresses.base.OETHb_WETH.gauge
  );

  const curveChildLiquidityGaugeFactory = await ethers.getContractAt(
    curveChildLiquidityGaugeFactoryAbi,
    addresses.base.childLiquidityGaugeFactory
  );

  const crv = await ethers.getContractAt(erc20Abi, addresses.base.CRV);

  return {
    // Aerodrome
    aeroSwapRouter,
    aeroNftManager,
    aeroClGauge,
    aero,

    // Curve
    crv,
    curvePoolOEthbWeth,
    curveGaugeOETHbWETH,
    curveChildLiquidityGaugeFactory,

    // OETHb
    oethb,
    oethbVault,
    wOETHb,
    zapper,
    harvester,
    dripper,

    // Bridged WOETH
    woeth,
    woethProxy,
    woethStrategy,
    oracleRouter,

    // Strategies
    aerodromeAmoStrategy,
    curveAMOStrategy,

    // WETH
    weth,

    // Signers
    governor,
    guardian,
    timelock,
    strategist,
    minter,
    burner,
    oethVaultSigner,

    rafael,
    nick,
    clement,

    // Helper
    quoter,
    sugar,
  };
};

const defaultBaseFixture = deployments.createFixture(defaultFixture);
const baseFixtureWithMockedVaultAdmin = deployments.createFixture(
  baseFixtureWithMockedVaultAdminConfig
);

const bridgeHelperModuleFixture = deployments.createFixture(async () => {
  const fixture = await defaultBaseFixture();

  const safeSigner = await impersonateAndFund(addresses.multichainStrategist);
  safeSigner.address = addresses.multichainStrategist;

  const bridgeHelperModule = await ethers.getContract("BaseBridgeHelperModule");

  const _mintWETH = async (user, amount) => {
    await impersonateAndFund(user.address);
    await fixture.weth.connect(user).deposit({ value: oethUnits(amount) });
  };

  const cSafe = await ethers.getContractAt(
    [
      "function enableModule(address module) external",
      "function isModuleEnabled(address module) external view returns (bool)",
    ],
    addresses.multichainStrategist
  );

  if (isFork && !(await cSafe.isModuleEnabled(bridgeHelperModule.address))) {
    await cSafe.connect(safeSigner).enableModule(bridgeHelperModule.address);
  }

  return {
    ...fixture,
    bridgeHelperModule,
    safeSigner,
    _mintWETH,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultBaseFixture,
  baseFixtureWithMockedVaultAdmin,
  MINTER_ROLE,
  BURNER_ROLE,
  bridgeHelperModuleFixture,
};
