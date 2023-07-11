const hre = require("hardhat");

const { ethers } = hre;

const addresses = require("../utils/addresses");
const {
  fundAccounts,
  fundAccountsForOETHUnitTests,
} = require("../utils/funding");
const { getAssetAddresses, daiUnits, isFork, oethUnits } = require("./helpers");

const { loadFixture, getOracleAddresses } = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const erc20Abi = require("./abi/erc20.json");
const morphoAbi = require("./abi/morpho.json");
const morphoLensAbi = require("./abi/morphoLens.json");
const crvMinterAbi = require("./abi/crvMinter.json");

// const curveFactoryAbi = require("./abi/curveFactory.json")
const ousdMetapoolAbi = require("./abi/ousdMetapool.json");
const threepoolLPAbi = require("./abi/threepoolLP.json");
const threepoolSwapAbi = require("./abi/threepoolSwap.json");

const sfrxETHAbi = require("./abi/sfrxETH.json");
const { deployWithConfirmation } = require("../utils/deploy");
const { defaultAbiCoder, parseUnits, parseEther } = require("ethers/lib/utils");

const defaultFixture = deployments.createFixture(async () => {
  await deployments.fixture(
    isFork
      ? undefined
      : process.env.FORKED_LOCAL_TEST
      ? ["none"]
      : ["unit_tests"],
    {
      keepExistingDeployments: true,
    }
  );

  const { governorAddr, strategistAddr, timelockAddr } =
    await getNamedAccounts();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const harvesterProxy = await ethers.getContract("HarvesterProxy");

  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
  const oethProxy = await ethers.getContract("OETHProxy");
  const OETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const oethVault = await ethers.getContractAt(
    "IVault",
    OETHVaultProxy.address
  );
  const oeth = await ethers.getContractAt("OETH", oethProxy.address);

  let woeth, woethProxy;

  if (isFork) {
    woethProxy = await ethers.getContract("WOETHProxy");
    woeth = await ethers.getContractAt("WOETH", woethProxy.address);
  }

  const harvester = await ethers.getContractAt(
    "Harvester",
    harvesterProxy.address
  );

  const dripperProxy = await ethers.getContract("DripperProxy");
  const dripper = await ethers.getContractAt("Dripper", dripperProxy.address);
  const wousdProxy = await ethers.getContract("WrappedOUSDProxy");
  const wousd = await ethers.getContractAt("WrappedOusd", wousdProxy.address);
  const governorContract = await ethers.getContract("Governor");
  const CompoundStrategyFactory = await ethers.getContractFactory(
    "CompoundStrategy"
  );
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundStrategyProxy.address
  );

  const threePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );
  const threePoolStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    threePoolStrategyProxy.address
  );
  const convexStrategyProxy = await ethers.getContract("ConvexStrategyProxy");
  const convexStrategy = await ethers.getContractAt(
    "ConvexStrategy",
    convexStrategyProxy.address
  );

  const OUSDmetaStrategyProxy = await ethers.getContract(
    "ConvexOUSDMetaStrategyProxy"
  );
  const OUSDmetaStrategy = await ethers.getContractAt(
    "ConvexOUSDMetaStrategy",
    OUSDmetaStrategyProxy.address
  );

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const aaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    aaveStrategyProxy.address
  );

  const oracleRouter = await ethers.getContract("OracleRouter");
  const oethOracleRouter = await ethers.getContract(
    isFork ? "OETHOracleRouter" : "OracleRouter"
  );

  const buybackProxy = await ethers.getContract("BuybackProxy");
  const buyback = await ethers.getContractAt("Buyback", buybackProxy.address);

  let usdt,
    dai,
    tusd,
    usdc,
    weth,
    ogn,
    ogv,
    rewardsSource,
    nonStandardToken,
    cusdt,
    cdai,
    cusdc,
    comp,
    adai,
    ausdt,
    ausdc,
    aave,
    aaveToken,
    stkAave,
    aaveIncentivesController,
    reth,
    stETH,
    frxETH,
    sfrxETH,
    mockNonRebasing,
    mockNonRebasingTwo,
    LUSD;

  let chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    crv,
    crvMinter,
    threePool,
    threePoolToken,
    metapoolToken,
    morpho,
    morphoCompoundStrategy,
    fraxEthStrategy,
    morphoAaveStrategy,
    oethMorphoAaveStrategy,
    morphoLens,
    LUSDMetapoolToken,
    threePoolGauge,
    aaveAddressProvider,
    uniswapPairOUSD_USDT,
    liquidityRewardOUSD_USDT,
    flipper,
    cvx,
    cvxBooster,
    cvxRewardPool,
    LUSDMetaStrategyProxy,
    LUSDMetaStrategy,
    oethHarvester,
    oethDripper,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
    ConvexEthMetaStrategyProxy,
    ConvexEthMetaStrategy;

  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(erc20Abi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
    weth = await ethers.getContractAt("IWETH9", addresses.mainnet.WETH);
    cusdt = await ethers.getContractAt(erc20Abi, addresses.mainnet.cUSDT);
    cdai = await ethers.getContractAt(erc20Abi, addresses.mainnet.cDAI);
    cusdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.cUSDC);
    comp = await ethers.getContractAt(erc20Abi, addresses.mainnet.COMP);
    crv = await ethers.getContractAt(erc20Abi, addresses.mainnet.CRV);
    cvx = await ethers.getContractAt(erc20Abi, addresses.mainnet.CVX);
    ogn = await ethers.getContractAt(erc20Abi, addresses.mainnet.OGN);
    LUSD = await ethers.getContractAt(erc20Abi, addresses.mainnet.LUSD);
    aave = await ethers.getContractAt(erc20Abi, addresses.mainnet.Aave);
    ausdt = await ethers.getContractAt(erc20Abi, addresses.mainnet.aUSDT);
    ausdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.aUSDC);
    adai = await ethers.getContractAt(erc20Abi, addresses.mainnet.aDAI);
    reth = await ethers.getContractAt(erc20Abi, addresses.mainnet.rETH);
    stETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.stETH);
    frxETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.frxETH);
    sfrxETH = await ethers.getContractAt(sfrxETHAbi, addresses.mainnet.sfrxETH);
    reth = await ethers.getContractAt(erc20Abi, addresses.mainnet.rETH);
    stETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.stETH);
    morpho = await ethers.getContractAt(morphoAbi, addresses.mainnet.Morpho);
    morphoLens = await ethers.getContractAt(
      morphoLensAbi,
      addresses.mainnet.MorphoLens
    );

    crvMinter = await ethers.getContractAt(
      crvMinterAbi,
      addresses.mainnet.CRVMinter
    );
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      addresses.mainnet.AAVE_ADDRESS_PROVIDER
    );
    rewardsSource = addresses.mainnet.RewardsSource;
    cvxBooster = await ethers.getContractAt(
      "MockBooster",
      addresses.mainnet.CVXBooster
    );
    cvxRewardPool = await ethers.getContractAt(
      "IRewardStaking",
      addresses.mainnet.CVXRewardsPool
    );

    const morphoCompoundStrategyProxy = await ethers.getContract(
      "MorphoCompoundStrategyProxy"
    );
    morphoCompoundStrategy = await ethers.getContractAt(
      "MorphoCompoundStrategy",
      morphoCompoundStrategyProxy.address
    );

    const morphoAaveStrategyProxy = await ethers.getContract(
      "MorphoAaveStrategyProxy"
    );
    morphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      morphoAaveStrategyProxy.address
    );

    const oethMorphoAaveStrategyProxy = await ethers.getContract(
      "OETHMorphoAaveStrategyProxy"
    );
    oethMorphoAaveStrategy = await ethers.getContractAt(
      "MorphoAaveStrategy",
      oethMorphoAaveStrategyProxy.address
    );

    const fraxEthStrategyProxy = await ethers.getContract(
      "FraxETHStrategyProxy"
    );
    fraxEthStrategy = await ethers.getContractAt(
      "FraxETHStrategy",
      fraxEthStrategyProxy.address
    );

    const oethHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    oethHarvester = await ethers.getContractAt(
      "OETHHarvester",
      oethHarvesterProxy.address
    );

    ConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );
    ConvexEthMetaStrategy = await ethers.getContractAt(
      "ConvexEthMetaStrategy",
      ConvexEthMetaStrategyProxy.address
    );

    const oethDripperProxy = await ethers.getContract("OETHDripperProxy");
    oethDripper = await ethers.getContractAt(
      "OETHDripper",
      oethDripperProxy.address
    );

    // Replace OracelRouter to disable staleness
    const dMockOracleRouterNoStale = await deployWithConfirmation(
      "MockOracleRouterNoStale"
    );
    const dMockOETHOracleRouterNoStale = await deployWithConfirmation(
      "MockOETHOracleRouterNoStale"
    );
    await replaceContractAt(oracleRouter.address, dMockOracleRouterNoStale);
    await replaceContractAt(
      oethOracleRouter.address,
      dMockOETHOracleRouterNoStale
    );
    swapper = await ethers.getContract("Swapper1InchV5");
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    weth = await ethers.getContract("MockWETH");
    ogn = await ethers.getContract("MockOGN");
    LUSD = await ethers.getContract("MockLUSD");
    ogv = await ethers.getContract("MockOGV");
    reth = await ethers.getContract("MockRETH");
    frxETH = await ethers.getContract("MockfrxETH");
    sfrxETH = await ethers.getContract("MocksfrxETH");
    stETH = await ethers.getContract("MockstETH");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");

    cdai = await ethers.getContract("MockCDAI");
    cusdt = await ethers.getContract("MockCUSDT");
    cusdc = await ethers.getContract("MockCUSDC");
    comp = await ethers.getContract("MockCOMP");

    crv = await ethers.getContract("MockCRV");
    cvx = await ethers.getContract("MockCVX");
    crvMinter = await ethers.getContract("MockCRVMinter");
    threePool = await ethers.getContract("MockCurvePool");
    threePoolToken = await ethers.getContract("Mock3CRV");
    metapoolToken = await ethers.getContract("MockCurveMetapool");
    LUSDMetapoolToken = await ethers.getContract("MockCurveLUSDMetapool");
    threePoolGauge = await ethers.getContract("MockCurveGauge");
    cvxBooster = await ethers.getContract("MockBooster");
    cvxRewardPool = await ethers.getContract("MockRewardPool");

    adai = await ethers.getContract("MockADAI");
    aaveToken = await ethers.getContract("MockAAVEToken");
    aave = await ethers.getContract("MockAave");
    // currently in test the mockAave is itself the address provder
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      aave.address
    );
    stkAave = await ethers.getContract("MockStkAave");
    aaveIncentivesController = await ethers.getContract(
      "MockAaveIncentivesController"
    );

    uniswapPairOUSD_USDT = await ethers.getContract("MockUniswapPairOUSD_USDT");
    liquidityRewardOUSD_USDT = await ethers.getContractAt(
      "LiquidityReward",
      (
        await ethers.getContract("LiquidityRewardOUSD_USDTProxy")
      ).address
    );

    chainlinkOracleFeedDAI = await ethers.getContract(
      "MockChainlinkOracleFeedDAI"
    );
    chainlinkOracleFeedUSDT = await ethers.getContract(
      "MockChainlinkOracleFeedUSDT"
    );
    chainlinkOracleFeedUSDC = await ethers.getContract(
      "MockChainlinkOracleFeedUSDC"
    );
    chainlinkOracleFeedOGNETH = await ethers.getContract(
      "MockChainlinkOracleFeedOGNETH"
    );
    chainlinkOracleFeedETH = await ethers.getContract(
      "MockChainlinkOracleFeedETH"
    );

    // Mock contracts for testing rebase opt out
    mockNonRebasing = await ethers.getContract("MockNonRebasing");
    await mockNonRebasing.setOUSD(ousd.address);
    mockNonRebasingTwo = await ethers.getContract("MockNonRebasingTwo");
    await mockNonRebasingTwo.setOUSD(ousd.address);

    flipper = await ethers.getContract("Flipper");

    LUSDMetaStrategyProxy = await ethers.getContract(
      "ConvexLUSDMetaStrategyProxy"
    );
    LUSDMetaStrategy = await ethers.getContractAt(
      "ConvexGeneralizedMetaStrategy",
      LUSDMetaStrategyProxy.address
    );

    const fraxEthStrategyProxy = await ethers.getContract(
      "FraxETHStrategyProxy"
    );
    fraxEthStrategy = await ethers.getContractAt(
      "FraxETHStrategy",
      fraxEthStrategyProxy.address
    );
    swapper = await ethers.getContract("MockSwapper");
    mockSwapper = await ethers.getContract("MockSwapper");
    swapper1Inch = await ethers.getContract("Swapper1InchV5");
    mock1InchSwapRouter = await ethers.getContract("Mock1InchSwapRouter");
  }

  if (!isFork) {
    const assetAddresses = await getAssetAddresses(deployments);

    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Add TUSD in fixture, it is disabled by default in deployment
    await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD, 0);

    // Enable capital movement
    await vault.connect(sGovernor).unpauseCapital();

    // Add Buyback contract as trustee
    await vault.connect(sGovernor).setTrusteeAddress(buyback.address);
  }

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  let strategist = signers[0];
  const adjuster = signers[0];
  let timelock;
  let oldTimelock;

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);

  if (isFork) {
    governor = await impersonateAndFundContract(governorAddr);
    strategist = await impersonateAndFundContract(strategistAddr);
    timelock = await impersonateAndFundContract(timelockAddr);
    oldTimelock = await impersonateAndFundContract(
      addresses.mainnet.OldTimelock
    );
  }
  await fundAccounts();
  if (isFork) {
    for (const user of [josh, matt, anna, domen, daniel, franck]) {
      // Approve Vault to move funds
      for (const asset of [ousd, usdt, usdc, dai]) {
        await resetAllowance(asset, user, vault.address);
      }

      for (const asset of [oeth, frxETH]) {
        await resetAllowance(asset, user, oethVault.address);
      }
    }
  } else {
    // Matt and Josh each have $100 OUSD
    for (const user of [matt, josh]) {
      await dai.connect(user).approve(vault.address, daiUnits("100"));
      await vault.connect(user).mint(dai.address, daiUnits("100"), 0);
    }
  }
  if (!rewardsSource && !isFork) {
    const address = await buyback.connect(governor).rewardsSource();
    rewardsSource = await ethers.getContractAt([], address);
  }
  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    strategist,
    adjuster,
    domen,
    daniel,
    franck,
    timelock,
    oldTimelock,
    // Contracts
    ousd,
    vault,
    harvester,
    dripper,
    mockNonRebasing,
    mockNonRebasingTwo,
    // Oracle
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    governorContract,
    compoundStrategy,
    oracleRouter,
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
    ogn,
    LUSD,
    weth,
    ogv,
    reth,
    stETH,
    rewardsSource,
    nonStandardToken,
    // cTokens
    cdai,
    cusdc,
    cusdt,
    comp,
    // aTokens,
    adai,
    ausdt,
    ausdc,
    // CompoundStrategy contract factory to deploy
    CompoundStrategyFactory,
    // ThreePool
    crv,
    crvMinter,
    threePool,
    threePoolGauge,
    threePoolToken,
    metapoolToken,
    morpho,
    morphoLens,
    LUSDMetapoolToken,
    threePoolStrategy,
    convexStrategy,
    OUSDmetaStrategy,
    LUSDMetaStrategy,
    morphoCompoundStrategy,
    morphoAaveStrategy,
    cvx,
    cvxBooster,
    cvxRewardPool,

    aaveStrategy,
    aaveToken,
    aaveAddressProvider,
    aaveIncentivesController,
    aave,
    stkAave,
    uniswapPairOUSD_USDT,
    liquidityRewardOUSD_USDT,
    flipper,
    buyback,
    wousd,
    //OETH
    oethVault,
    oeth,
    frxETH,
    sfrxETH,
    fraxEthStrategy,
    oethMorphoAaveStrategy,
    woeth,
    ConvexEthMetaStrategy,
    oethDripper,
    oethHarvester,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
  };
});

function defaultFixtureSetup() {
  return deployments.createFixture(async () => {
    return await defaultFixture();
  });
}

async function oethDefaultFixture() {
  // TODO: Trim it down to only do OETH things
  const fixture = await defaultFixture();

  const { weth, reth, stETH, frxETH, sfrxETH } = fixture;
  const { matt, josh, domen, daniel, franck, governor, oethVault } = fixture;

  if (isFork) {
    for (const user of [matt, josh, domen, daniel, franck]) {
      // Everyone gets free WETH
      await mintWETH(weth, user);

      // And vault can rug them all
      await resetAllowance(weth, user, oethVault.address);
    }
  } else {
    // Replace frxETHMinter
    await replaceContractAt(
      addresses.mainnet.FraxETHMinter,
      await ethers.getContract("MockFrxETHMinter")
    );
    const mockedMinter = await ethers.getContractAt(
      "MockFrxETHMinter",
      addresses.mainnet.FraxETHMinter
    );
    await mockedMinter.connect(franck).setAssetAddress(fixture.sfrxETH.address);

    // Replace WETH contract with MockWETH
    const mockWETH = await ethers.getContract("MockWETH");
    await replaceContractAt(addresses.mainnet.WETH, mockWETH);
    const stubbedWETH = await ethers.getContractAt(
      "MockWETH",
      addresses.mainnet.WETH
    );
    fixture.weth = stubbedWETH;

    // And Fund it
    _hardhatSetBalance(stubbedWETH.address, "999999999999999");

    // And make sure vault knows about it
    await oethVault.connect(governor).supportAsset(addresses.mainnet.WETH, 0);

    // Fund all with mockTokens
    await fundAccountsForOETHUnitTests();

    // Reset allowances
    for (const user of [matt, josh, domen, daniel, franck]) {
      for (const asset of [stubbedWETH, reth, stETH, frxETH, sfrxETH]) {
        await resetAllowance(asset, user, oethVault.address);
      }
    }
  }

  return fixture;
}

function oethDefaultFixtureSetup() {
  return deployments.createFixture(async () => {
    return await oethDefaultFixture();
  });
}

function oethCollateralSwapFixtureSetup() {
  return deployments.createFixture(async () => {
    const fixture = await oethDefaultFixture();

    const { weth, reth, stETH, frxETH, matt, strategist, oethVault } = fixture;

    const bufferBps = await oethVault.vaultBuffer();
    const shouldChangeBuffer = bufferBps.lt(oethUnits("1"));

    if (shouldChangeBuffer) {
      // If it's not 100% already, set it to 100%
      await oethVault.connect(strategist).setVaultBuffer(
        oethUnits("1") // 100%
      );
    }

    for (const token of [weth, reth, stETH, frxETH]) {
      await token
        .connect(matt)
        .approve(
          oethVault.address,
          parseEther("100000000000000000000000000000000000").toString()
        );

      // Mint some tokens, so it ends up in Vault
      await oethVault.connect(matt).mint(token.address, parseEther("25"), "0");
    }

    if (shouldChangeBuffer) {
      // Set it back
      await oethVault.connect(strategist).setVaultBuffer(bufferBps);
    }

    return fixture;
  });
}

function oeth1InchSwapperFixtureSetup() {
  return deployments.createFixture(async () => {
    const fixture = await oethDefaultFixture();
    const { mock1InchSwapRouter } = fixture;

    const swapRouterAddr = "0x1111111254EEB25477B68fb85Ed929f73A960582";
    await replaceContractAt(swapRouterAddr, mock1InchSwapRouter);

    const stubbedRouterContract = await hre.ethers.getContractAt(
      "Mock1InchSwapRouter",
      swapRouterAddr
    );
    fixture.mock1InchSwapRouter = stubbedRouterContract;

    return fixture;
  });
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Initialize and configure MockVault
  const cMockVault = await ethers.getContract("MockVault");

  // There is no need to initialize and setup the mock vault because the
  // proxy itself is already setup and the proxy is the one with the storage

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sGovernor).upgradeTo(cMockVault.address);

  fixture.mockVault = await ethers.getContractAt(
    "MockVault",
    cVaultProxy.address
  );

  return fixture;
}

/**
 * Configure a Vault with only the Compound strategy.
 */
async function compoundVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const assetAddresses = await getAssetAddresses(deployments);

  // Approve in Vault
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.compoundStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.compoundStrategy.address, true);

  // Add USDT
  await fixture.compoundStrategy
    .connect(sGovernor)
    .setPTokenAddress(assetAddresses.USDT, assetAddresses.cUSDT);
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.compoundStrategy.address
    );
  // Add USDC
  await fixture.compoundStrategy
    .connect(sGovernor)
    .setPTokenAddress(assetAddresses.USDC, assetAddresses.cUSDC);
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.compoundStrategy.address
    );
  // Add allocation mapping for DAI
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.dai.address,
      fixture.compoundStrategy.address
    );

  return fixture;
}

/**
 * Configure a Vault with only the 3Pool strategy.
 */
async function threepoolVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add 3Pool
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.threePoolStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.threePoolStrategy.address, true);

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.threePoolStrategy.address
    );
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.threePoolStrategy.address
    );
  return fixture;
}

/**
 * Configure a Vault with only the Convex strategy.
 */
async function convexVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add Convex
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.convexStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.convexStrategy.address, true);

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.convexStrategy.address
    );
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.convexStrategy.address
    );
  return fixture;
}

async function fundWith3Crv(address, maxAmount) {
  // Get some 3CRV from most loaded contracts/wallets
  await impersonateAndFundAddress(
    addresses.mainnet.ThreePoolToken,
    [
      "0xceaf7747579696a2f0bb206a14210e3c9e6fb269",
      "0xd632f22692fac7611d2aa1c0d552930d43caed3b",
      "0xbfcf63294ad7105dea65aa58f8ae5be2d9d0952a",
      "0xed279fdd11ca84beef15af5d39bb4d4bee23f0ca",
      "0x43b4fdfd4ff969587185cdb6f0bd875c5fc83f8c",
    ],
    address,
    30, // balanceToUse
    maxAmount
  );
}

/**
 * Configure a Vault with only the Meta strategy.
 */
async function convexMetaVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  if (isFork) {
    const { josh, matt, anna, domen, daniel, franck, ousd } = fixture;

    // const curveFactoryAddress = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'

    const threepoolLP = await ethers.getContractAt(
      threepoolLPAbi,
      addresses.mainnet.ThreePoolToken
    );
    const ousdMetaPool = await ethers.getContractAt(
      ousdMetapoolAbi,
      addresses.mainnet.CurveOUSDMetaPool
    );
    const threepoolSwap = await ethers.getContractAt(
      threepoolSwapAbi,
      addresses.mainnet.ThreePool
    );
    // const curveFactory = await ethers.getContractAt(curveFactoryAbi, curveFactoryAddress)

    // Domen is loaded with 3CRV
    await fundWith3Crv(domen.getAddress(), ethers.BigNumber.from("0"));

    for (const user of [josh, matt, anna, domen, daniel, franck]) {
      // Approve OUSD MetaPool contract to move funds
      await resetAllowance(threepoolLP, user, ousdMetaPool.address);
      await resetAllowance(ousd, user, ousdMetaPool.address);
    }

    fixture.ousdMetaPool = ousdMetaPool;
    fixture.threePoolToken = threepoolLP;
    fixture.threepoolSwap = threepoolSwap;
  } else {
    // Migrations should do these on fork
    const { governorAddr } = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Add Convex Meta strategy
    await fixture.vault
      .connect(sGovernor)
      .approveStrategy(fixture.OUSDmetaStrategy.address);

    // set meta strategy on vault so meta strategy is allowed to mint OUSD
    await fixture.vault
      .connect(sGovernor)
      .setOusdMetaStrategy(fixture.OUSDmetaStrategy.address);

    // set OUSD mint threshold to 50 million
    await fixture.vault
      .connect(sGovernor)
      .setNetOusdMintForStrategyThreshold(parseUnits("50", 24));

    await fixture.harvester
      .connect(sGovernor)
      .setSupportedStrategy(fixture.OUSDmetaStrategy.address, true);

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.OUSDmetaStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.OUSDmetaStrategy.address
      );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function morphoCompoundFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { timelock } = fixture;

  if (isFork) {
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.dai.address,
        fixture.morphoCompoundStrategy.address
      );
  } else {
    throw new Error(
      "Morpho strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function morphoAaveFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { timelock } = fixture;

  if (isFork) {
    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.morphoAaveStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoAaveStrategy.address
      );

    await fixture.vault
      .connect(timelock)
      .setAssetDefaultStrategy(
        fixture.dai.address,
        fixture.morphoAaveStrategy.address
      );
  } else {
    throw new Error(
      "Morpho strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
function oethMorphoAaveFixtureSetup() {
  return deployments.createFixture(async () => {
    const fixture = await oethDefaultFixture();

    if (isFork) {
      const { oethVault, timelock, weth, oethMorphoAaveStrategy } = fixture;

      await oethVault
        .connect(timelock)
        .setAssetDefaultStrategy(weth.address, oethMorphoAaveStrategy.address);
    } else {
      throw new Error(
        "Morpho strategy only supported in forked test environment"
      );
    }

    return fixture;
  });
}

/**
 * FraxETHStrategy fixture
 *
 */
function fraxETHStrategyFixtureSetup() {
  return deployments.createFixture(async () => {
    const fixture = await oethDefaultFixture();

    if (isFork) {
      const { oethVault, frxETH, fraxEthStrategy, timelock } = fixture;
      await oethVault
        .connect(timelock)
        .setAssetDefaultStrategy(frxETH.address, fraxEthStrategy.address);
    } else {
      const { governorAddr } = await getNamedAccounts();
      const { oethVault, frxETH, fraxEthStrategy } = fixture;
      const sGovernor = await ethers.provider.getSigner(governorAddr);

      // Approve Strategy
      await oethVault
        .connect(sGovernor)
        .approveStrategy(fraxEthStrategy.address);

      // Set as default
      await oethVault
        .connect(sGovernor)
        .setAssetDefaultStrategy(frxETH.address, fraxEthStrategy.address);
    }

    return fixture;
  });
}

/**
 * Generalized strategy fixture that works only in forked environment
 *
 * @param metapoolAddress -> the address of the metapool
 * @param rewardPoolAddress -> address of the reward staker contract
 * @param metastrategyProxyName -> name of the generalizedMetastrategy proxy contract
 */
async function convexGeneralizedMetaForkedFixture(
  metapoolAddress,
  rewardPoolAddress,
  metastrategyProxyName,
  lpTokenAddress
) {
  return async () => {
    const fixture = await loadFixture(defaultFixture);
    const { timelockAddr } = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(timelockAddr);
    const { josh, matt, anna, domen, daniel, franck } = fixture;

    const threepoolLP = await ethers.getContractAt(
      threepoolLPAbi,
      addresses.mainnet.ThreePoolToken
    );
    const metapool = await ethers.getContractAt(
      ousdMetapoolAbi,
      metapoolAddress
    );

    const primaryCoin = await ethers.getContractAt(
      erc20Abi,
      await metapool.coins(0)
    );

    const threepoolSwap = await ethers.getContractAt(
      threepoolSwapAbi,
      addresses.mainnet.ThreePool
    );

    const lpToken = await ethers.getContractAt(erc20Abi, lpTokenAddress);

    for (const user of [josh, matt, anna, domen, daniel, franck]) {
      // Approve Metapool contract to move funds
      await resetAllowance(threepoolLP, user, metapoolAddress);
      await resetAllowance(primaryCoin, user, metapoolAddress);
    }

    // Get some 3CRV from most loaded contracts/wallets
    await impersonateAndFundAddress(
      addresses.mainnet.ThreePoolToken,
      [
        "0xceaf7747579696a2f0bb206a14210e3c9e6fb269",
        "0xd632f22692fac7611d2aa1c0d552930d43caed3b",
        "0xbfcf63294ad7105dea65aa58f8ae5be2d9d0952a",
        "0xed279fdd11ca84beef15af5d39bb4d4bee23f0ca",
        "0x43b4fdfd4ff969587185cdb6f0bd875c5fc83f8c",
      ],
      // Domen is loaded with 3CRV
      domen.getAddress()
    );

    fixture.metapoolCoin = primaryCoin;
    fixture.metapool = metapool;
    fixture.metapoolLpToken = lpToken;
    fixture.threePoolToken = threepoolLP;
    fixture.threepoolSwap = threepoolSwap;

    fixture.metaStrategyProxy = await ethers.getContract(metastrategyProxyName);
    fixture.metaStrategy = await ethers.getContractAt(
      "ConvexGeneralizedMetaStrategy",
      fixture.metaStrategyProxy.address
    );

    fixture.rewardPool = await ethers.getContractAt(
      "IRewardStaking",
      rewardPoolAddress
    );

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.metaStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.metaStrategy.address
      );

    return fixture;
  };
}

async function impersonateAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
}

async function _hardhatSetBalance(address, amount = "10000") {
  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [
      address,
      parseEther(amount)
        .toHexString()
        .replace(/^0x0+/, "0x")
        .replace(/0$/, "1"),
    ],
  });
}

async function impersonateAndFundContract(address, amount = "100000") {
  await impersonateAccount(address);

  await _hardhatSetBalance(address, amount);

  return await ethers.provider.getSigner(address);
}

async function impersonateAndFundAddress(
  tokenAddress,
  contractAddresses,
  toAddress,
  balanceToUse = 30, // 30%
  maxAmount = ethers.BigNumber.from(0)
) {
  if (!Array.isArray(contractAddresses)) {
    contractAddresses = [contractAddresses];
  }

  let amountTransfered = ethers.BigNumber.from("0");
  for (const contractAddress of contractAddresses) {
    const impersonatedSigner = await impersonateAndFundContract(
      contractAddress
    );

    const tokenContract = await ethers.getContractAt(daiAbi, tokenAddress);

    const balance = await tokenContract
      .connect(impersonatedSigner)
      .balanceOf(contractAddress);

    const amount = balance.mul(balanceToUse).div(100);
    // consider max amount
    if (maxAmount.gt(ethers.BigNumber.from("0"))) {
      if (amountTransfered.add(amount).gt(maxAmount)) {
        await tokenContract
          .connect(impersonatedSigner)
          .transfer(toAddress, maxAmount.sub(amountTransfered));

        // max amount already transferred
        return;
      }

      amountTransfered.add(amount);
    }

    await tokenContract.connect(impersonatedSigner).transfer(toAddress, amount);
  }
}

async function resetAllowance(
  tokenContract,
  signer,
  toAddress,
  allowance = "10000000000000000000000000000000000000000000000000"
) {
  await tokenContract.connect(signer).approve(toAddress, "0");
  await tokenContract.connect(signer).approve(toAddress, allowance);
}

async function mintWETH(weth, recipient, amount = "100") {
  await _hardhatSetBalance(recipient.address, (Number(amount) * 2).toString());
  await weth.connect(recipient).deposit({
    value: parseEther(amount),
  });
}

async function withImpersonatedAccount(address, cb) {
  const signer = await impersonateAndFundContract(address);

  await cb(signer);

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  });
}

/**
 * Configure a Vault with only the LUSD Generalized Meta strategy.
 */
async function convexLUSDMetaVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Add Convex Meta strategy
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.LUSDMetaStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.LUSDMetaStrategy.address, true);

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.LUSDMetaStrategy.address
    );

  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.LUSDMetaStrategy.address
    );

  return fixture;
}

/**
 * Configure a Vault with only the OETH/(W)ETH Curve Metastrategy.
 */
async function convexOETHMetaVaultFixture() {
  const fixture = await loadFixture(defaultFixture);
  const { ConvexEthMetaStrategy, oethVault, josh, timelock, weth } = fixture;

  await impersonateAndFundAddress(
    weth.address,
    [
      "0x8EB8a3b98659Cce290402893d0123abb75E3ab28",
      "0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3",
      "0x57757E3D981446D585Af0D9Ae4d7DF6D64647806",
      "0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3",
      "0x6B44ba0a126a2A1a8aa6cD1AdeeD002e141Bcd44",
    ],
    // Josh is loaded with weth
    josh.getAddress()
  );

  // Get some CRV from most loaded contracts/wallets
  await impersonateAndFundAddress(
    addresses.mainnet.CRV,
    [
      "0x0A2634885B47F15064fB2B33A86733C614c9950A",
      "0x34ea4138580435B5A521E460035edb19Df1938c1",
      "0x28C6c06298d514Db089934071355E5743bf21d60",
      "0xa6a4d3218BBf0E81B38390396f9EA7eb8B9c9820",
      "0xb73D8dCE603155e231aAd4381a2F20071Ca4D55c",
    ],
    // Josh is loaded with CRV
    josh.getAddress()
  );

  // Add Convex Meta strategy
  await oethVault
    .connect(timelock)
    .setAssetDefaultStrategy(weth.address, ConvexEthMetaStrategy.address);

  // Update the strategy threshold to 100k ETH
  await oethVault
    .connect(timelock)
    .setNetOusdMintForStrategyThreshold(parseUnits("100", 21));

  // Convex pool that records the deposited balances
  fixture.cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    await ConvexEthMetaStrategy.cvxRewardStaker()
  );

  fixture.oethMetaPool = await ethers.getContractAt(
    ousdMetapoolAbi,
    addresses.mainnet.CurveOETHMetaPool
  );

  return fixture;
}

/**
 * Configure a Vault with only the Aave strategy.
 */
async function aaveVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add Aave which only supports DAI
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.aaveStrategy.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(fixture.aaveStrategy.address, true);

  // Add direct allocation of DAI to Aave
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(fixture.dai.address, fixture.aaveStrategy.address);
  return fixture;
}

/**
 * Configure a compound fixture with a false vault for testing
 */
async function compoundFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StandaloneCompound", {
    from: governorAddr,
    contract: "CompoundStrategy",
  });

  fixture.cStandalone = await ethers.getContract("StandaloneCompound");

  // Set governor as vault
  await fixture.cStandalone.connect(sGovernor).initialize(
    addresses.dead,
    governorAddr, // Using Governor in place of Vault here
    [assetAddresses.COMP],
    [assetAddresses.DAI, assetAddresses.USDC],
    [assetAddresses.cDAI, assetAddresses.cUSDC]
  );

  await fixture.cStandalone
    .connect(sGovernor)
    .setHarvesterAddress(fixture.harvester.address);

  await fixture.usdc.transfer(
    await fixture.matt.getAddress(),
    parseUnits("1000", 6)
  );

  return fixture;
}

/**
 * Configure a threepool fixture with the governer as vault for testing
 */
async function threepoolFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StandaloneThreePool", {
    from: governorAddr,
    contract: "ThreePoolStrategy",
  });

  fixture.tpStandalone = await ethers.getContract("StandaloneThreePool");

  // Set governor as vault
  await fixture.tpStandalone.connect(sGovernor)[
    // eslint-disable-next-line
    "initialize(address,address,address[],address[],address[],address,address)"
  ](
    assetAddresses.ThreePool,
    governorAddr, // Using Governor in place of Vault here
    [assetAddresses.CRV],
    [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
    [
      assetAddresses.ThreePoolToken,
      assetAddresses.ThreePoolToken,
      assetAddresses.ThreePoolToken,
    ],
    assetAddresses.ThreePoolGauge,
    assetAddresses.CRVMinter
  );

  return fixture;
}

/**
 * Configure a Vault with two strategies
 */
async function multiStrategyVaultFixture() {
  const fixture = await compoundVaultFixture();
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StrategyTwo", {
    from: governorAddr,
    contract: "CompoundStrategy",
  });

  const cStrategyTwo = await ethers.getContract("StrategyTwo");
  // Initialize the second strategy with DAI and USDC
  await cStrategyTwo
    .connect(sGovernor)
    .initialize(
      addresses.dead,
      fixture.vault.address,
      [assetAddresses.COMP],
      [assetAddresses.DAI, assetAddresses.USDC],
      [assetAddresses.cDAI, assetAddresses.cUSDC]
    );

  await cStrategyTwo
    .connect(sGovernor)
    .setHarvesterAddress(fixture.harvester.address);

  // Add second strategy to Vault
  await fixture.vault.connect(sGovernor).approveStrategy(cStrategyTwo.address);

  await fixture.harvester
    .connect(sGovernor)
    .setSupportedStrategy(cStrategyTwo.address, true);

  // DAI to second strategy
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(fixture.dai.address, cStrategyTwo.address);

  // Set up third strategy
  await deploy("StrategyThree", {
    from: governorAddr,
    contract: "CompoundStrategy",
  });
  const cStrategyThree = await ethers.getContract("StrategyThree");
  // Initialize the third strategy with only DAI
  await cStrategyThree
    .connect(sGovernor)
    .initialize(
      addresses.dead,
      fixture.vault.address,
      [assetAddresses.COMP],
      [assetAddresses.DAI],
      [assetAddresses.cDAI]
    );

  await cStrategyThree
    .connect(sGovernor)
    .setHarvesterAddress(fixture.harvester.address);

  fixture.strategyTwo = cStrategyTwo;
  fixture.strategyThree = cStrategyThree;
  return fixture;
}

/**
 * Configure a hacked Vault
 */
async function hackedVaultFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { vault, oracleRouter } = fixture;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const oracleAddresses = await getOracleAddresses(hre.deployments);

  await deploy("MockEvilDAI", {
    from: governorAddr,
    args: [vault.address, assetAddresses.DAI],
  });

  const evilDAI = await ethers.getContract("MockEvilDAI");
  /* Mock oracle feeds report 0 for updatedAt data point. Set
   * maxStaleness to 100 years from epoch to make the Oracle
   * feeds valid
   */
  const maxStaleness = 24 * 60 * 60 * 365 * 100;

  await oracleRouter.setFeed(
    evilDAI.address,
    oracleAddresses.chainlink.DAI_USD,
    maxStaleness
  );
  await oracleRouter.cacheDecimals(evilDAI.address);

  await fixture.vault.connect(sGovernor).supportAsset(evilDAI.address, 0);

  fixture.evilDAI = evilDAI;

  return fixture;
}

/**
 * Configure a reborn hack attack
 */
async function rebornFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const { vault } = fixture;

  await deploy("Sanctum", {
    from: governorAddr,
    args: [assetAddresses.DAI, vault.address],
  });

  const sanctum = await ethers.getContract("Sanctum");

  const encodedCallbackAddress = defaultAbiCoder
    .encode(["address"], [sanctum.address])
    .slice(2);
  const initCode = (await ethers.getContractFactory("Reborner")).bytecode;
  const deployCode = `${initCode}${encodedCallbackAddress}`;

  await sanctum.deploy(12345, deployCode);
  const rebornAddress = await sanctum.computeAddress(12345, deployCode);
  const reborner = await ethers.getContractAt("Reborner", rebornAddress);

  const rebornAttack = async (shouldAttack = true, targetMethod = null) => {
    await sanctum.setShouldAttack(shouldAttack);
    if (targetMethod) await sanctum.setTargetMethod(targetMethod);
    await sanctum.setOUSDAddress(fixture.ousd.address);
    await sanctum.deploy(12345, deployCode);
  };

  fixture.reborner = reborner;
  fixture.rebornAttack = rebornAttack;

  return fixture;
}

async function replaceContractAt(targetAddress, mockContract) {
  const signer = (await hre.ethers.getSigners())[0];
  const mockCode = await signer.provider.getCode(mockContract.address);

  await hre.network.provider.request({
    method: "hardhat_setCode",
    params: [targetAddress, mockCode],
  });
}

module.exports = {
  fundWith3Crv,
  resetAllowance,
  defaultFixture,
  defaultFixtureSetup,
  oethDefaultFixtureSetup,
  mockVaultFixture,
  compoundFixture,
  compoundVaultFixture,
  multiStrategyVaultFixture,
  threepoolFixture,
  threepoolVaultFixture,
  convexVaultFixture,
  convexMetaVaultFixture,
  convexOETHMetaVaultFixture,
  convexGeneralizedMetaForkedFixture,
  convexLUSDMetaVaultFixture,
  morphoCompoundFixture,
  morphoAaveFixture,
  aaveVaultFixture,
  hackedVaultFixture,
  rebornFixture,
  withImpersonatedAccount,
  impersonateAndFundContract,
  impersonateAccount,
  fraxETHStrategyFixtureSetup,
  oethMorphoAaveFixtureSetup,
  mintWETH,
  replaceContractAt,
  oeth1InchSwapperFixtureSetup,
  oethCollateralSwapFixtureSetup,
};
