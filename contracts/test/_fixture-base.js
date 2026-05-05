const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { parseUnits, formatUnits } = require("ethers/lib/utils");
const { isFork, isBaseFork, oethUnits, usdcUnits } = require("./helpers");
const { impersonateAndFund, impersonateAccount } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const { deployWithConfirmation, withConfirmation } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const erc20Abi = require("./abi/erc20.json");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");

const log = require("../utils/logger")("test:fixtures-base");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

  let aerodromeAmoStrategy, harvester, quoter, sugar, curveAMOStrategy;
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
  const mockStrategy = isFork
    ? undefined
    : await ethers.getContract("MockStrategy");

  // WETH
  let weth, aero, usdc;

  if (isFork) {
    weth = await ethers.getContractAt("IWETH9", addresses.base.WETH);
    aero = await ethers.getContractAt(erc20Abi, addresses.base.AERO);
    usdc = await ethers.getContractAt(erc20Abi, addresses.base.USDC);
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

    // Bridged WOETH
    woeth,
    woethProxy,
    woethStrategy,

    // Strategies
    aerodromeAmoStrategy,
    curveAMOStrategy,
    mockStrategy,

    // Tokens
    weth,
    usdc,

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

const bridgeHelperModuleFixture = deployments.createFixture(async () => {
  const fixture = await defaultBaseFixture();

  const safeSigner = await impersonateAndFund(addresses.multichainStrategist);
  safeSigner.address = addresses.multichainStrategist;

  const bridgeHelperModule = await ethers.getContract("BaseBridgeHelperModule");

  const _mintWETH = async (user, amount) => {
    await impersonateAndFund(user.address, (Number(amount) + 1).toString());
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

const crossChainFixture = deployments.createFixture(async () => {
  const fixture = await defaultBaseFixture();
  const crossChainStrategyProxyAddress =
    addresses.base.CrossChainRemoteStrategy;
  const crossChainRemoteStrategy = await ethers.getContractAt(
    "CrossChainRemoteStrategy",
    crossChainStrategyProxyAddress
  );

  await deployWithConfirmation("CCTPMessageTransmitterMock2", [
    fixture.usdc.address,
    6, // Base CCTP source domain
  ]);
  const mockMessageTransmitter = await ethers.getContract(
    "CCTPMessageTransmitterMock2"
  );
  await deployWithConfirmation("CCTPTokenMessengerMock", [
    fixture.usdc.address,
    mockMessageTransmitter.address,
  ]);
  const mockTokenMessenger = await ethers.getContract("CCTPTokenMessengerMock");
  await mockMessageTransmitter.setCCTPTokenMessenger(
    addresses.CCTPTokenMessengerV2
  );

  const usdcMinter = await impersonateAndFund(
    "0x2230393EDAD0299b7E7B59F20AA856cD1bEd52e1"
  );
  const usdcContract = await ethers.getContractAt(
    [
      "function mint(address to, uint256 amount) external",
      "function configureMinter(address minter, uint256 minterAmount) external",
    ],
    addresses.base.USDC
  );

  await usdcContract
    .connect(usdcMinter)
    .configureMinter(fixture.rafael.address, usdcUnits("100000000"));

  await usdcContract
    .connect(fixture.rafael)
    .mint(fixture.rafael.address, usdcUnits("1000000"));

  fixture.relayer = await impersonateAndFund(addresses.base.OZRelayerAddress);

  return {
    ...fixture,
    crossChainRemoteStrategy,
    mockMessageTransmitter,
    mockTokenMessenger,
  };
});

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

/**
 * Resolve the Hydrex gauge contract for the OETHb/WETH pool. Returns the live
 * gauge if `addresses.base.HydrexOETHb_WETH.gauge` is set and has code on the
 * fork; otherwise deploys a `MockHydrexGauge`. Until Hydrex deploys the real
 * gauge for this pool the fork test always lands on the mock branch.
 */
async function _mockHydrexGaugeIfNeeded(poolAddress, rewardTokenAddress) {
  const configured = addresses.base.HydrexOETHb_WETH.gauge;

  if (configured !== ZERO_ADDRESS) {
    const code = await ethers.provider.getCode(configured);
    if (code && code !== "0x") {
      return {
        gauge: await ethers.getContractAt("IGauge", configured),
        isMock: false,
      };
    }
  }

  console.warn(
    "USING MOCK HYDREX GAUGE — replace addresses.base.HydrexOETHb_WETH.gauge " +
      "with the live Hydrex GaugeV2 once it has been deployed for the " +
      "superOETHb/WETH pool."
  );

  // Use the timelock as both owner and distribution — both are easy to
  // impersonate in tests, and the behavior suite reads them via the gauge.
  const { timelockAddr } = await getNamedAccounts();
  await deployWithConfirmation("MockHydrexGauge", [
    poolAddress,
    rewardTokenAddress,
    timelockAddr,
    timelockAddr,
  ]);
  const cMockGauge = await ethers.getContract("MockHydrexGauge");
  return {
    gauge: await ethers.getContractAt("IGauge", cMockGauge.address),
    isMock: true,
  };
}

async function oethbHydrexAMOFixture(
  config = {
    assetMintAmount: 0,
    depositToStrategy: false,
    balancePool: false,
    poolAddWethAmount: 0,
    poolAddOethAmount: 0,
  }
) {
  if (!isFork || !isBaseFork) {
    throw new Error(
      "oethbHydrexAMOFixture is only supported on Base fork tests"
    );
  }

  const fixture = await defaultFixture();
  const { oethb, oethbVault, weth, governor, strategist, nick } = fixture;

  const cfg = {
    assetMintAmount: config?.assetMintAmount || 0,
    depositToStrategy: config?.depositToStrategy || false,
    balancePool: config?.balancePool || false,
    poolAddWethAmount: config?.poolAddWethAmount || 0,
    poolAddOethAmount: config?.poolAddOethAmount || 0,
  };

  // Pool already exists on Base. Connect to it.
  const hydrexPool = await ethers.getContractAt(
    "IPair",
    addresses.base.HydrexOETHb_WETH.pool
  );

  // Resolve / mock the gauge.
  const { gauge: hydrexGauge, isMock: hydrexGaugeIsMock } =
    await _mockHydrexGaugeIfNeeded(hydrexPool.address, addresses.base.HYDX);

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  await impersonateAndFund(deployerAddr);

  // Deploy proxy + implementation against the (possibly mocked) gauge address.
  await deployWithConfirmation("OETHbHydrexAMOProxy");
  const cOETHbHydrexAMOProxy = await ethers.getContract("OETHbHydrexAMOProxy");

  const dHydrexAMOStrategy = await deployWithConfirmation(
    "OETHbHydrexAMOStrategy",
    [[hydrexPool.address, oethbVault.address], hydrexGauge.address]
  );

  const cOETHbHydrexAMOStrategy = await ethers.getContractAt(
    "OETHbHydrexAMOStrategy",
    cOETHbHydrexAMOProxy.address
  );

  // Initialize the proxy (only if not already initialized in a previous run).
  const currentImpl = await cOETHbHydrexAMOProxy.implementation();
  if (currentImpl === ZERO_ADDRESS) {
    const depositPriceRange = parseUnits("0.01", 18); // 1% / 100 bp
    const initData = cOETHbHydrexAMOStrategy.interface.encodeFunctionData(
      "initialize(address[],uint256)",
      [[addresses.base.HYDX], depositPriceRange]
    );
    await withConfirmation(
      // prettier-ignore
      cOETHbHydrexAMOProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dHydrexAMOStrategy.address,
          addresses.base.timelock,
          initData
        )
    );
  }

  // Wire the strategy into the OETHBase Vault.
  await withConfirmation(
    oethbVault.connect(governor).approveStrategy(cOETHbHydrexAMOProxy.address)
  );
  await withConfirmation(
    oethbVault
      .connect(governor)
      .addStrategyToMintWhitelist(cOETHbHydrexAMOProxy.address)
  );

  // Match the deploy script (048_oethb_hydrex_amo): the harvester address on
  // the strategy is the multichain strategist multisig, not the SuperOETH
  // Harvester proxy. The behavior suite's harvest config also expects the
  // strategist to be both the caller and the recipient of reward tokens.
  const sStrategyGovernor = await impersonateAndFund(addresses.base.timelock);
  await withConfirmation(
    cOETHbHydrexAMOStrategy
      .connect(sStrategyGovernor)
      .setHarvesterAddress(addresses.base.multichainStrategist)
  );

  // Reward token handle (HYDX).
  const hydrexRewardToken = await ethers.getContractAt(
    erc20Abi,
    addresses.base.HYDX
  );

  // The behavior suite calls `gauge.notifyRewardAmount(token, amount)` from
  // the impersonated DISTRIBUTION address, which uses `transferFrom`. On a
  // real Hydrex Voter→Gauge wiring this allowance is pre-set during gauge
  // creation. With our mock we have to set it explicitly.
  if (hydrexGaugeIsMock) {
    const distributionAddr = await hydrexGauge.DISTRIBUTION();
    const distributionSigner = await impersonateAndFund(distributionAddr);
    await hydrexRewardToken
      .connect(distributionSigner)
      .approve(hydrexGauge.address, ethers.constants.MaxUint256);
  }

  // Impersonate the OETHBase Vault so tests can call deposit/withdraw on the
  // strategy directly.
  const oethbVaultSigner = await impersonateAndFund(oethbVault.address);

  // Ensure `nick` has plenty of WETH to mint OETHb and seed/manipulate pool.
  await hhHelpers.setBalance(nick.address, oethUnits("1000000"));
  await weth.connect(nick).deposit({ value: oethUnits("500000") });

  // Seed the pool once if it's effectively empty (Hydrex pool today has dust
  // reserves only — ~100 gwei per side).
  const seedAmount = parseUnits("150");
  if ((await hydrexPool.totalSupply()).lt(seedAmount.mul(2))) {
    await weth.connect(nick).approve(oethbVault.address, seedAmount.mul(2));
    await oethbVault.connect(nick).mint(seedAmount.mul(2));
    await weth.connect(nick).transfer(hydrexPool.address, seedAmount);
    await oethb.connect(nick).transfer(hydrexPool.address, seedAmount);
    await hydrexPool.connect(nick).mint(nick.address);
  }

  // Mint some OETHb using WETH if configured.
  if (cfg.assetMintAmount > 0) {
    const wethAmount = parseUnits(cfg.assetMintAmount.toString());

    // Flush any accrued yield into OETHb supply so the protocol sits at
    // exactly 1:1 backing before the test mint. The "with an insolvent vault"
    // suite assumes a fresh-peg starting state; without rebase first, the
    // pre-existing yield buffer absorbs the 21bp loss the suite simulates.
    await oethbVault.connect(nick).rebase();

    let wethBalance = await weth.balanceOf(oethbVault.address);
    const queue = await oethbVault.withdrawalQueueMetadata();
    const available = wethBalance.add(queue.claimed).sub(queue.queued);
    // Mint 10x the requested amount to dilute the existing OETHb yield buffer.
    // Without this, the "with an insolvent vault" suite cannot push the
    // protocol below the 0.998 solvency threshold with its 21bp loss because
    // pre-existing yield absorbs it. (Same approach as the Sonic fixture.)
    const mintAmount = wethAmount.sub(available).mul(10);

    if (mintAmount.gt(0)) {
      await weth.connect(nick).approve(oethbVault.address, mintAmount);
      await oethbVault.connect(nick).mint(mintAmount);
    }

    if (cfg.depositToStrategy) {
      wethBalance = await weth.balanceOf(oethbVault.address);
      log(
        `Depositing ${formatUnits(
          wethAmount
        )} WETH to OETHb Hydrex AMO strategy. Vault has ${formatUnits(
          wethBalance
        )} WETH`
      );
      await oethbVault
        .connect(strategist)
        .depositToStrategy(
          cOETHbHydrexAMOStrategy.address,
          [weth.address],
          [wethAmount]
        );
    }
  }

  if (cfg.balancePool) {
    const { _reserve0, _reserve1 } = await hydrexPool.getReserves();
    const oTokenPoolIndex =
      (await hydrexPool.token0()) === oethb.address ? 0 : 1;
    const assetReserves = oTokenPoolIndex === 0 ? _reserve1 : _reserve0;
    const oTokenReserves = oTokenPoolIndex === 0 ? _reserve0 : _reserve1;

    const diff = parseInt(
      assetReserves.sub(oTokenReserves).div(oethUnits("1")).toString()
    );

    if (diff > 0) {
      cfg.poolAddOethAmount += diff;
    } else if (diff < 0) {
      cfg.poolAddWethAmount += -diff;
    }
  }

  // Add WETH to the pool directly.
  if (cfg.poolAddWethAmount > 0) {
    log(`Adding ${cfg.poolAddWethAmount} WETH to the pool`);
    const wethAmount = parseUnits(cfg.poolAddWethAmount.toString(), 18);
    await weth.connect(nick).transfer(hydrexPool.address, wethAmount);
  }

  // Add OETHb to the pool directly.
  if (cfg.poolAddOethAmount > 0) {
    log(`Adding ${cfg.poolAddOethAmount} OETHb to the pool`);
    const oethAmount = parseUnits(cfg.poolAddOethAmount.toString(), 18);
    await weth.connect(nick).approve(oethbVault.address, oethAmount);
    await oethbVault.connect(nick).mint(oethAmount);
    await oethb.connect(nick).transfer(hydrexPool.address, oethAmount);
  }

  await hydrexPool.sync();

  // The behavior suite uses `.connect(timelock)` and expects a signer.
  // The default Base fixture exposes `timelock` as a contract object; replace
  // it with the impersonated timelock signer for AMO behavior tests.
  const timelockSigner = await impersonateAndFund(addresses.base.timelock);
  // JsonRpcSigner does not expose `.address`; behavior tests read it directly.
  timelockSigner.address = addresses.base.timelock;

  return {
    ...fixture,
    timelock: timelockSigner,
    oethbVaultSigner,
    hydrexRewardToken,
    hydrexPool,
    hydrexGauge,
    hydrexAMOStrategy: cOETHbHydrexAMOStrategy,
    hydrexGaugeIsMock,
  };
}

module.exports = {
  defaultBaseFixture,
  MINTER_ROLE,
  BURNER_ROLE,
  bridgeHelperModuleFixture,
  crossChainFixture,
  oethbHydrexAMOFixture,
};
