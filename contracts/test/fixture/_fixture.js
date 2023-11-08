const hre = require("hardhat");
const { ethers } = hre;
const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { setFraxOraclePrice } = require("../../utils/frax");
require("./_global-hooks");

//const { setChainlinkOraclePrice } = require("../utils/oracle");

const {
  deployBalancerFrxEethRethWstEThStrategyMissConfigured,
} = require("./_custom-deploys");
const {
  hotDeployBalancerRethWETHStrategy,
  hotDeployBalancerFrxEethRethWstEThStrategy,
} = require("./_hot-deploy");
const { replaceContractAt } = require("../../utils/deploy");
const {
  balancer_rETH_WETH_PID,
  balancer_stETH_WETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
} = require("../../utils/constants");
const {
  fundAccounts,
  fundAccountsForOETHUnitTests,
} = require("../../utils/funding");
const {
  getAssetAddresses,
  daiUnits,
  getOracleAddresses,
  oethUnits,
  ousdUnits,
  units,
  isFork,
} = require("../helpers");
const { hardhatSetBalance, setERC20TokenBalance } = require("../_fund");

const daiAbi = require("../abi/dai.json").abi;
const usdtAbi = require("../abi/usdt.json").abi;
const erc20Abi = require("../abi/erc20.json");
const morphoAbi = require("../abi/morpho.json");
const morphoLensAbi = require("../abi/morphoLens.json");
const crvMinterAbi = require("../abi/crvMinter.json");
const sdaiAbi = require("../abi/sDAI.json");

// const curveFactoryAbi = require("../abi/curveFactory.json")
const ousdMetapoolAbi = require("../abi/ousdMetapool.json");
const oethMetapoolAbi = require("../abi/oethMetapool.json");
const threepoolLPAbi = require("../abi/threepoolLP.json");
const composableStablePoolBptAbi = require("../abi/composableStablePoolBpt.json");
const threepoolSwapAbi = require("../abi/threepoolSwap.json");
const sfrxETHAbi = require("../abi/sfrxETH.json");

const { defaultAbiCoder, parseUnits, parseEther } = require("ethers/lib/utils");
const balancerStrategyDeployment = require("../../utils/balancerStrategyDeployment");
const { impersonateAndFund } = require("../../utils/signers");

const log = require("../../utils/logger")("test:fixtures");

const defaultFixture = deployments.createFixture(async () => {
  log(`Forked from block: ${await hre.ethers.provider.getBlockNumber()}`);

  log(`Before deployments with param "${isFork ? undefined : ["unit_tests"]}"`);

  // Run the contract deployments
  await deployments.fixture(isFork ? undefined : ["unit_tests"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  log(`Block after deployments: ${await hre.ethers.provider.getBlockNumber()}`);

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
    wstETH,
    frxETH,
    sfrxETH,
    sDAI,
    mockNonRebasing,
    mockNonRebasingTwo,
    LUSD,
    fdai,
    fusdt,
    fusdc;

  let chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedOGNETH,
    chainlinkOracleFeedETH,
    crv,
    crvMinter,
    aura,
    bal,
    threePool,
    threePoolToken,
    metapoolToken,
    morpho,
    morphoCompoundStrategy,
    fraxEthStrategy,
    balancerREthStrategy,
    balancerSfrxWstRETHStrategy,
    makerDsrStrategy,
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
    oethZapper,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
    convexEthMetaStrategyProxy,
    convexEthMetaStrategy,
    fluxStrategy,
    vaultValueChecker,
    oethVaultValueChecker;

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
    reth = await ethers.getContractAt("IRETH", addresses.mainnet.rETH);
    frxETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.frxETH);
    sfrxETH = await ethers.getContractAt(sfrxETHAbi, addresses.mainnet.sfrxETH);
    stETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.stETH);
    wstETH = await ethers.getContractAt(erc20Abi, addresses.mainnet.wstETH);
    sDAI = await ethers.getContractAt(sdaiAbi, addresses.mainnet.sDAI);
    morpho = await ethers.getContractAt(morphoAbi, addresses.mainnet.Morpho);
    morphoLens = await ethers.getContractAt(
      morphoLensAbi,
      addresses.mainnet.MorphoLens
    );
    fdai = await ethers.getContractAt(erc20Abi, addresses.mainnet.fDAI);
    fusdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.fUSDC);
    fusdt = await ethers.getContractAt(erc20Abi, addresses.mainnet.fUSDT);
    aura = await ethers.getContractAt(erc20Abi, addresses.mainnet.AURA);
    bal = await ethers.getContractAt(erc20Abi, addresses.mainnet.BAL);

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

    const makerDsrStrategyProxy = await ethers.getContract(
      "MakerDsrStrategyProxy"
    );
    makerDsrStrategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      makerDsrStrategyProxy.address
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

    const balancerRethStrategyProxy = await ethers.getContract(
      "OETHBalancerMetaPoolrEthStrategyProxy"
    );
    balancerREthStrategy = await ethers.getContractAt(
      "BalancerMetaPoolStrategy",
      balancerRethStrategyProxy.address
    );

    const balancerSfrxWstRETHStrategyProxy = await ethers.getContract(
      "OETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy"
    );
    balancerSfrxWstRETHStrategy = await ethers.getContractAt(
      "BalancerComposablePoolStrategy",
      balancerSfrxWstRETHStrategyProxy.address
    );

    const oethHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    oethHarvester = await ethers.getContractAt(
      "OETHHarvester",
      oethHarvesterProxy.address
    );

    convexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );
    convexEthMetaStrategy = await ethers.getContractAt(
      "ConvexEthMetaStrategy",
      convexEthMetaStrategyProxy.address
    );

    const oethDripperProxy = await ethers.getContract("OETHDripperProxy");
    oethDripper = await ethers.getContractAt(
      "OETHDripper",
      oethDripperProxy.address
    );

    oethZapper = await ethers.getContract("OETHZapper");

    swapper = await ethers.getContract("Swapper1InchV5");

    const fluxStrategyProxy = await ethers.getContract("FluxStrategyProxy");
    fluxStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      fluxStrategyProxy.address
    );

    vaultValueChecker = await ethers.getContract("VaultValueChecker");
    oethVaultValueChecker = await ethers.getContract("OETHVaultValueChecker");
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    weth = await ethers.getContractAt("MockWETH", addresses.mainnet.WETH);
    ogn = await ethers.getContract("MockOGN");
    LUSD = await ethers.getContract("MockLUSD");
    ogv = await ethers.getContract("MockOGV");
    reth = await ethers.getContract("MockRETH");
    frxETH = await ethers.getContract("MockfrxETH");
    sfrxETH = await ethers.getContract("MocksfrxETH");
    sDAI = await ethers.getContract("MocksfrxETH");
    stETH = await ethers.getContract("MockstETH");
    wstETH = await ethers.getContract("MockwstETH");
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
    governor = await ethers.provider.getSigner(governorAddr);
    strategist = await ethers.provider.getSigner(strategistAddr);
    timelock = await ethers.provider.getSigner(timelockAddr);
    oldTimelock = await ethers.provider.getSigner(
      addresses.mainnet.OldTimelock
    );
  } else {
    timelock = governor;
  }

  if (!isFork) {
    await fundAccounts();

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
    vaultValueChecker,
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
    oethOracleRouter,
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
    wstETH,
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
    makerDsrStrategy,
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

    // Flux strategy
    fluxStrategy,
    fdai,
    fusdc,
    fusdt,

    // OETH
    oethVault,
    oethVaultValueChecker,
    oeth,
    frxETH,
    sfrxETH,
    sDAI,
    fraxEthStrategy,
    balancerREthStrategy,
    balancerSfrxWstRETHStrategy,
    oethMorphoAaveStrategy,
    woeth,
    convexEthMetaStrategy,
    oethDripper,
    oethHarvester,
    oethZapper,
    swapper,
    mockSwapper,
    swapper1Inch,
    mock1InchSwapRouter,
    aura,
    bal,
  };
});

async function oethDefaultFixture() {
  // TODO: Trim it down to only do OETH things
  const fixture = await defaultFixture();

  const { weth, reth, stETH, frxETH, sfrxETH } = fixture;
  const { matt, josh, domen, daniel, franck, oethVault } = fixture;

  if (isFork) {
    for (const user of [matt, josh, domen, daniel, franck]) {
      // Everyone gets free tokens
      for (const token of [weth, reth, stETH, frxETH, sfrxETH]) {
        await setERC20TokenBalance(user.address, token, "1000000", hre);

        // And vault can rug them all
        await resetAllowance(token, user, oethVault.address);
      }
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

    // Fund WETH contract
    await hardhatSetBalance(weth.address, "999999999999999");

    // Fund all with mockTokens
    await fundAccountsForOETHUnitTests();

    // Reset allowances
    for (const user of [matt, josh, domen, daniel, franck]) {
      for (const asset of [weth, reth, stETH, frxETH, sfrxETH]) {
        await resetAllowance(asset, user, oethVault.address);
      }
    }
  }

  return fixture;
}

async function oethCollateralSwapFixture() {
  const fixture = await oethDefaultFixture();

  // const { timelock, oethVault } = fixture;
  const { weth, reth, stETH, frxETH, matt, strategist, timelock, oethVault } =
    fixture;

  const bufferBps = await oethVault.vaultBuffer();
  const shouldChangeBuffer = bufferBps.lt(oethUnits("1"));

  if (shouldChangeBuffer) {
    // If it's not 100% already, set it to 100%
    await oethVault.connect(strategist).setVaultBuffer(
      oethUnits("1") // 100%
    );
  }

  // Set frxETH/ETH price above 0.998 so we can mint OETH using frxETH
  await setFraxOraclePrice(parseUnits("0.999", 18));

  for (const token of [weth, reth, stETH, frxETH]) {
    await token
      .connect(matt)
      .approve(
        oethVault.address,
        parseEther("100000000000000000000000000000000000")
      );

    // Mint some tokens, so it ends up in Vault
    await oethVault.connect(matt).mint(token.address, parseEther("200"), "0");
  }

  if (shouldChangeBuffer) {
    // Set it back
    await oethVault.connect(strategist).setVaultBuffer(bufferBps);
  }

  // Withdraw all from strategies so we have assets to swap
  await oethVault.connect(timelock).withdrawAllFromStrategies();

  return fixture;
}

async function ousdCollateralSwapFixture() {
  const fixture = await defaultFixture();

  const { dai, usdc, usdt, matt, strategist, timelock, vault } = fixture;

  const bufferBps = await vault.vaultBuffer();
  const shouldChangeBuffer = bufferBps.lt(ousdUnits("1"));

  if (shouldChangeBuffer) {
    // If it's not 100% already, set it to 100%
    await vault.connect(strategist).setVaultBuffer(
      ousdUnits("1") // 100%
    );
  }

  await usdt.connect(matt).approve(vault.address, 0);
  for (const token of [dai, usdc, usdt]) {
    await token
      .connect(matt)
      .approve(vault.address, await units("10000", token));

    // Mint some tokens, so it ends up in Vault
    await vault.connect(matt).mint(token.address, await units("500", token), 0);
  }

  if (shouldChangeBuffer) {
    // Set it back
    await vault.connect(strategist).setVaultBuffer(bufferBps);
  }

  // Withdraw all from strategies so we have assets to swap
  await vault.connect(timelock).withdrawAllFromStrategies();

  return fixture;
}

async function oeth1InchSwapperFixture() {
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
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

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

/**
 * Configure a Vault with the balancerREthStrategy
 */
async function balancerREthFixture(config = { defaultStrategy: true }) {
  const fixture = await defaultFixture();
  const { oethVault, timelock, weth, reth, balancerREthStrategy, josh } =
    fixture;

  if (config.defaultStrategy) {
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(reth.address, balancerREthStrategy.address);
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(weth.address, balancerREthStrategy.address);
  }

  fixture.rEthBPT = await ethers.getContractAt(
    "IERC20Metadata",
    addresses.mainnet.rETH_WETH_BPT,
    josh
  );
  fixture.balancerREthPID = balancer_rETH_WETH_PID;

  fixture.auraPool = await ethers.getContractAt(
    "IERC4626",
    addresses.mainnet.rETH_WETH_AuraRewards
  );

  fixture.balancerVault = await ethers.getContractAt(
    "IBalancerVault",
    addresses.mainnet.balancerVault,
    josh
  );

  // completely peg the rETH price
  // await setChainlinkOraclePrice(addresses.mainnet.rETH, await reth.getExchangeRate());

  await setERC20TokenBalance(josh.address, reth, "1000000", hre);
  await hardhatSetBalance(josh.address, "1000000");

  return fixture;
}

/**
 * Configure a Vault with the balancerFrxETHwstETHeETHStrategy
 */
async function balancerFrxETHwstETHeETHFixture(
  config = { defaultStrategy: true }
) {
  const fixture = await defaultFixture();
  const {
    oethVault,
    timelock,
    frxETH,
    stETH,
    reth,
    balancerSfrxWstRETHStrategy,
    josh,
  } = fixture;

  if (config.defaultStrategy) {
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(
        reth.address,
        balancerSfrxWstRETHStrategy.address
      );
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(
        stETH.address,
        balancerSfrxWstRETHStrategy.address
      );
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(
        frxETH.address,
        balancerSfrxWstRETHStrategy.address
      );
  }

  fixture.sfrxETHwstETHrEthBPT = await ethers.getContractAt(
    composableStablePoolBptAbi,
    addresses.mainnet.wstETH_sfrxETH_rETH_BPT,
    josh
  );
  fixture.sfrxETHwstETHrEthPID = balancer_wstETH_sfrxETH_rETH_PID;

  fixture.sfrxETHwstETHrEthAuraPool = await ethers.getContractAt(
    "IERC4626",
    addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards
  );

  fixture.balancerVault = await ethers.getContractAt(
    "IBalancerVault",
    addresses.mainnet.balancerVault,
    josh
  );

  await setERC20TokenBalance(josh.address, reth, "1000000", hre);
  await setERC20TokenBalance(josh.address, frxETH, "1000000", hre);
  await setERC20TokenBalance(josh.address, stETH, "1000000", hre);

  await hardhatSetBalance(josh.address, "1000000");

  // set the price to an acceptable level so that fork tests don't fail
  // even when it de-pegs.
  await setFraxOraclePrice(parseUnits("0.999", 18));
  return fixture;
}

/**
 * Configure a Vault with the Balancer strategy for rETH/WETH pool and
 * replace the byte code with the one that exposes internal functions
 */
async function balancerRethWETHExposeFunctionFixture() {
  const fixture = await hotDeployBalancerRethWETHStrategy(balancerREthFixture);
  const { balancerREthStrategy, josh } = fixture;

  // IMPORTANT: remove once rETH/WETH is redeployed with the new code base
  await balancerREthStrategy.connect(josh).cachePoolAssets();
  // IMPORTANT also remove this one
  await balancerREthStrategy.connect(josh).cacheRateProviders();

  return fixture;
}

/**
 * Deploy the Balancer Composable Stable pool with incorrect configuration
 */
async function balancerSfrxETHRETHWstETHMissConfiguredStrategy() {
  return await deployBalancerFrxEethRethWstEThStrategyMissConfigured();
}

/**
 * Configure a Vault with the Balancer strategy for frxEth/Reth/wstEth pool and
 * replace the byte code with the one that exposes internal functions
 */
async function balancerSfrxETHRETHWstETHExposeFunctionFixture() {
  const fixture = await hotDeployBalancerFrxEethRethWstEThStrategy(
    balancerFrxETHwstETHeETHFixture
  );

  return fixture;
}

/**
 * Configure a Vault with the balancer strategy for wstETH/WETH pool
 */
async function balancerWstEthFixture() {
  const fixture = await defaultFixture();

  const d = balancerStrategyDeployment({
    deploymentOpts: {
      deployName: "99999_balancer_wstETH_WETH",
      forceDeploy: true,
      deployerIsProposer: true,
      reduceQueueTime: true,
    },
    proxyContractName: "OETHBalancerMetaPoolwstEthStrategyProxy",

    platformAddress: addresses.mainnet.wstETH_WETH_BPT,
    poolId: balancer_stETH_WETH_PID,

    auraRewardsContractAddress: addresses.mainnet.wstETH_WETH_AuraRewards,

    rewardTokenAddresses: [addresses.mainnet.BAL, addresses.mainnet.AURA],
    assets: [addresses.mainnet.stETH, addresses.mainnet.WETH],
  });

  await d(hre);

  const balancerWstEthStrategyProxy = await ethers.getContract(
    "OETHBalancerMetaPoolwstEthStrategyProxy"
  );
  const balancerWstEthStrategy = await ethers.getContractAt(
    "BalancerMetaPoolStrategy",
    balancerWstEthStrategyProxy.address
  );

  fixture.balancerWstEthStrategy = balancerWstEthStrategy;

  const { oethVault, timelock, weth, stETH, josh } = fixture;

  await oethVault
    .connect(timelock)
    .setAssetDefaultStrategy(stETH.address, balancerWstEthStrategy.address);
  await oethVault
    .connect(timelock)
    .setAssetDefaultStrategy(weth.address, balancerWstEthStrategy.address);

  fixture.stEthBPT = await ethers.getContractAt(
    "IERC20Metadata",
    addresses.mainnet.wstETH_WETH_BPT,
    josh
  );
  fixture.balancerWstEthPID = balancer_stETH_WETH_PID;

  fixture.auraPool = await ethers.getContractAt(
    "IERC4626",
    addresses.mainnet.wstETH_WETH_AuraRewards
  );

  fixture.balancerVault = await ethers.getContractAt(
    "IBalancerVault",
    addresses.mainnet.balancerVault,
    josh
  );

  return fixture;
}

/**
 * Configure a Vault with only the Meta strategy.
 */
async function convexMetaVaultFixture() {
  const fixture = await defaultFixture();

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

    const balances = await ousdMetaPool.get_balances();
    log(`Metapool balance 0: ${formatUnits(balances[0])}`);
    log(`Metapool balance 1: ${formatUnits(balances[1])}`);

    // Domen is loaded with 3CRV
    await hardhatSetBalance(domen.address, "1000000");
    await setERC20TokenBalance(domen.address, threepoolLP, "1000000", hre);

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
 * Configure a Vault with default DAI strategy to the Maker DSR strategy.
 */

async function makerDsrFixture(
  config = {
    daiMintAmount: 0,
    depositToStrategy: false,
  }
) {
  const fixture = await defaultFixture();

  if (isFork) {
    const { dai, josh, makerDsrStrategy, strategist, vault } = fixture;

    // Impersonate the OUSD Vault
    fixture.vaultSigner = await impersonateAndFund(vault.address);

    // mint some OUSD using DAI if configured
    if (config?.daiMintAmount > 0) {
      const daiMintAmount = parseUnits(config.daiMintAmount.toString());
      await vault.connect(josh).rebase();
      await vault.connect(josh).allocate();

      // Approve the Vault to transfer DAI
      await dai.connect(josh).approve(vault.address, daiMintAmount);

      // Mint OUSD with DAI
      // This will sit in the vault, not the strategy
      await vault.connect(josh).mint(dai.address, daiMintAmount, 0);

      // Add DAI to the Maker DSR Strategy
      if (config?.depositToStrategy) {
        // The strategist deposits the WETH to the AMO strategy
        await vault
          .connect(strategist)
          .depositToStrategy(
            makerDsrStrategy.address,
            [dai.address],
            [daiMintAmount]
          );
      }
    }
  } else {
    throw new Error(
      "Maker DSR strategy only supported in forked test environment"
    );
  }

  return fixture;
}

/**
 * Configure a Vault with only the Morpho strategy.
 */
async function morphoCompoundFixture() {
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

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
async function oethMorphoAaveFixture() {
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
}

/**
 * FraxETHStrategy fixture
 */
async function fraxETHStrategyFixture() {
  const fixture = await oethDefaultFixture();

  if (isFork) {
    const { oethVault, frxETH, fraxEthStrategy, timelock } = fixture;
    await oethVault
      .connect(timelock)
      .setAssetDefaultStrategy(frxETH.address, fraxEthStrategy.address);

    // Set frxETH/ETH price above 0.998 so we can mint OETH using frxETH
    await setFraxOraclePrice(parseUnits("0.999", 18));
  } else {
    const { governorAddr } = await getNamedAccounts();
    const { oethVault, frxETH, fraxEthStrategy } = fixture;
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Approve Strategy
    await oethVault.connect(sGovernor).approveStrategy(fraxEthStrategy.address);

    // Set as default
    await oethVault
      .connect(sGovernor)
      .setAssetDefaultStrategy(frxETH.address, fraxEthStrategy.address);
  }

  return fixture;
}

/**
 * Generalized strategy fixture that works only in forked environment
 *
 * @param metapoolAddress -> the address of the metapool
 * @param rewardPoolAddress -> address of the reward staker contract
 * @param metastrategyProxyName -> name of the generalizedMetastrategy proxy contract
 */
async function convexGeneralizedMetaForkedFixture(
  config = {
    metapoolAddress: addresses.mainnet.CurveOUSDMetaPool,
    rewardPoolAddress: addresses.mainnet.CVXRewardsPool,
    metastrategyProxyName: addresses.mainnet.ConvexOUSDAMOStrategy,
    lpTokenAddress: addresses.mainnet.ThreePoolToken,
  }
) {
  const {
    metapoolAddress,
    rewardPoolAddress,
    metastrategyProxyName,
    lpTokenAddress,
  } = config;
  const fixture = await defaultFixture();

  const { timelockAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(timelockAddr);
  const { josh, matt, anna, domen, daniel, franck } = fixture;

  const threepoolLP = await ethers.getContractAt(
    threepoolLPAbi,
    addresses.mainnet.ThreePoolToken
  );
  const metapool = await ethers.getContractAt(ousdMetapoolAbi, metapoolAddress);

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

  await impersonateAndFund(domen.address, "1000000");
  await setERC20TokenBalance(domen.address, threepoolLP, "1000000", hre);

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
}

async function nodeSnapshot() {
  return await hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
}

async function nodeRevert(snapshotId) {
  return await hre.network.provider.request({
    method: "evm_revert",
    params: [snapshotId],
  });
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

/**
 * Configure a Vault with only the LUSD Generalized Meta strategy.
 */
async function convexLUSDMetaVaultFixture() {
  const fixture = await defaultFixture();

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
async function convexOETHMetaVaultFixture(
  config = {
    wethMintAmount: 0,
    depositToStrategy: false,
    poolAddEthAmount: 0,
    poolAddOethAmount: 0,
  }
) {
  const fixture = await oethDefaultFixture();

  const {
    convexEthMetaStrategy,
    oeth,
    oethVault,
    josh,
    strategist,
    timelock,
    weth,
    crv,
  } = fixture;

  await impersonateAndFund(josh.address);
  await setERC20TokenBalance(josh.address, weth, "10000000", hre);
  await setERC20TokenBalance(josh.address, crv, "10000000", hre);

  // Update the strategy threshold to 500k ETH
  await oethVault
    .connect(timelock)
    .setNetOusdMintForStrategyThreshold(parseUnits("500", 21));

  // Impersonate the OETH Vault
  fixture.oethVaultSigner = await impersonateAndFund(oethVault.address);
  // Impersonate the Curve gauge that holds all the LP tokens
  fixture.oethGaugeSigner = await impersonateAndFund(
    addresses.mainnet.CurveOETHGauge
  );

  // Convex pool that records the deposited balances
  fixture.cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    addresses.mainnet.CVXETHRewardsPool
  );

  fixture.oethMetaPool = await ethers.getContractAt(
    oethMetapoolAbi,
    addresses.mainnet.CurveOETHMetaPool
  );

  // mint some OETH using WETH is configured
  if (config?.wethMintAmount > 0) {
    const wethAmount = parseUnits(config.wethMintAmount.toString());
    await oethVault.connect(josh).rebase();
    await oethVault.connect(josh).allocate();

    // Approve the Vault to transfer WETH
    await weth.connect(josh).approve(oethVault.address, wethAmount);

    // Mint OETH with WETH
    // This will sit in the vault, not the strategy
    await oethVault.connect(josh).mint(weth.address, wethAmount, 0);

    // Add ETH to the Metapool
    if (config?.depositToStrategy) {
      // The strategist deposits the WETH to the AMO strategy
      await oethVault
        .connect(strategist)
        .depositToStrategy(
          convexEthMetaStrategy.address,
          [weth.address],
          [wethAmount]
        );
    }
  }

  // Add ETH to the Metapool
  if (config?.poolAddEthAmount > 0) {
    // Fund Josh with ETH plus some extra for gas fees
    const fundAmount = config.poolAddEthAmount + 1;
    await hardhatSetBalance(josh.address, fundAmount.toString());

    const ethAmount = parseUnits(config.poolAddEthAmount.toString(), 18);
    // prettier-ignore
    await fixture.oethMetaPool
      .connect(josh)["add_liquidity(uint256[2],uint256)"]([ethAmount, 0], 0, {
        value: ethAmount,
      });
  }

  const { oethWhaleAddress } = addresses.mainnet;
  fixture.oethWhale = await impersonateAndFund(oethWhaleAddress);

  // Add OETH to the Metapool
  if (config?.poolAddOethAmount > 0) {
    const poolAddOethAmountUnits = parseUnits(
      config.poolAddOethAmount.toString()
    );

    const oethAmount = await oeth.balanceOf(oethWhaleAddress);
    log(`OETH whale balance     : ${formatUnits(oethAmount)}`);
    log(`OETH to add to Metapool: ${formatUnits(poolAddOethAmountUnits)}`);
    expect(oethAmount).to.be.gte(poolAddOethAmountUnits);
    await oeth
      .connect(fixture.oethWhale)
      .approve(fixture.oethMetaPool.address, poolAddOethAmountUnits);

    // prettier-ignore
    await fixture.oethMetaPool
      .connect(fixture.oethWhale)["add_liquidity(uint256[2],uint256)"]([0, poolAddOethAmountUnits], 0);
  }

  return fixture;
}

/**
 * Configure a Vault with only the Aave strategy.
 */
async function aaveVaultFixture() {
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StandaloneCompound", {
    from: governorAddr,
    contract: "CompoundStrategy",
    args: [
      [
        addresses.dead,
        governorAddr, // Using Governor in place of Vault here
      ],
    ],
  });

  fixture.cStandalone = await ethers.getContract("StandaloneCompound");

  // Set governor as vault
  await fixture.cStandalone
    .connect(sGovernor)
    .initialize(
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
  const fixture = await defaultFixture();

  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StandaloneThreePool", {
    from: governorAddr,
    contract: "ThreePoolStrategy",
    args: [
      [
        assetAddresses.ThreePool,
        governorAddr, // Using Governor in place of Vault here
      ],
    ],
  });

  fixture.tpStandalone = await ethers.getContract("StandaloneThreePool");

  // Set governor as vault
  await fixture.tpStandalone.connect(sGovernor)[
    // eslint-disable-next-line
    "initialize(address[],address[],address[],address,address)"
  ]([assetAddresses.CRV], [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT], [assetAddresses.ThreePoolToken, assetAddresses.ThreePoolToken, assetAddresses.ThreePoolToken], assetAddresses.ThreePoolGauge, assetAddresses.CRVMinter);

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
  const fixture = await defaultFixture();

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
  const fixture = await defaultFixture();

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

async function fluxStrategyFixture() {
  const fixture = await defaultFixture();

  const { fluxStrategy, timelock, vault, dai, usdt, usdc } = fixture;

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(dai.address, fluxStrategy.address);

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(usdt.address, fluxStrategy.address);

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(usdc.address, fluxStrategy.address);

  // Withdraw all from strategies and deposit it to Flux
  await vault.connect(timelock).withdrawAllFromStrategies();

  await vault.connect(timelock).rebase();

  return fixture;
}

/**
 * A fixture is a setup function that is run only the first time it's invoked. On subsequent invocations,
 * Hardhat will reset the state of the network to what it was at the point after the fixture was initially executed.
 * The returned `loadFixture` function is typically included in the beforeEach().
 * @example
 *   const loadFixture = createFixtureLoader(convexOETHMetaVaultFixture);
 *   beforeEach(async () => {
 *     fixture = await loadFixture();
 *   });
 * @example
 *   const loadFixture = createFixtureLoader(convexOETHMetaVaultFixture, {
 *     wethMintAmount: 5000,
 *     depositToStrategy: false,
 *   });
 *   beforeEach(async () => {
 *     fixture = await loadFixture();
 *   });
 * @param {*} fixture async function that sets up test data. eg users, contracts and protocols
 * @param {*} config optional config object passed to the fixture function
 * @returns loadFixture an async function that loads a fixture
 */
function createFixtureLoader(fixture, config) {
  return deployments.createFixture(async () => {
    return await fixture(config);
  });
}

/**
 * An async function that loads the default fixture for unit or fork tests
 * @example
 *   let fixture;
 *   beforeEach(async () => {
 *     fixture = await loadDefaultFixture();
 *   });
 */
async function loadDefaultFixture() {
  return await defaultFixture();
}

module.exports = {
  createFixtureLoader,
  loadDefaultFixture,
  resetAllowance,
  defaultFixture,
  oethDefaultFixture,
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
  makerDsrFixture,
  morphoCompoundFixture,
  morphoAaveFixture,
  aaveVaultFixture,
  hackedVaultFixture,
  rebornFixture,
  balancerREthFixture,
  balancerFrxETHwstETHeETHFixture,
  balancerWstEthFixture,
  fraxETHStrategyFixture,
  oethMorphoAaveFixture,
  oeth1InchSwapperFixture,
  oethCollateralSwapFixture,
  ousdCollateralSwapFixture,
  balancerRethWETHExposeFunctionFixture,
  balancerSfrxETHRETHWstETHExposeFunctionFixture,
  balancerSfrxETHRETHWstETHMissConfiguredStrategy,
  fluxStrategyFixture,
  nodeSnapshot,
  nodeRevert,
};
