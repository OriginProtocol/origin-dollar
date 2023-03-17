const hre = require("hardhat");

const { ethers } = hre;

const addresses = require("../utils/addresses");
const { fundAccounts } = require("../utils/funding");
const {
  getAssetAddresses,
  daiUnits,
  isFork,
  isForkWithLocalNode,
} = require("./helpers");
const { utils } = require("ethers");

const { airDropPayouts } = require("../scripts/staking/airDrop.js");
const testPayouts = require("../scripts/staking/rawAccountsToBeCompensated.json");
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

async function defaultFixture() {
  await deployments.fixture(isFork ? undefined : ["unit_tests"], {
    keepExistingDeployments: true, // Boolean(isForkWithLocalNode),
  });

  const { governorAddr, timelockAddr, operatorAddr } = await getNamedAccounts();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");
  const harvesterProxy = await ethers.getContract("HarvesterProxy");
  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
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

  const ognStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    (
      await ethers.getContract("OGNStakingProxy")
    ).address
  );

  const oracleRouter = await ethers.getContract("OracleRouter");

  const testPayoutsModified = {
    ...testPayouts,
    payouts: testPayouts.payouts.map((each) => {
      return { address: each[0], ogn_compensation: each[1] };
    }),
  };

  const signedPayouts = await airDropPayouts(
    ognStaking.address,
    testPayoutsModified
  );
  const compensationClaims = await ethers.getContract("CompensationClaims");

  const buyback = await ethers.getContract("Buyback");

  const UniV3_USDC_USDT_Proxy = await ethers.getContract(
    "UniV3_USDC_USDT_Proxy"
  );
  const UniV3_USDC_USDT_Strategy = await ethers.getContractAt(
    Array.from(
      new Set([
        ...(
          await ethers.getContractFactory("UniswapV3Strategy")
        ).interface.format("full"),
        ...(
          await ethers.getContractFactory("UniswapV3LiquidityManager")
        ).interface.format("full"),
      ])
    ),
    UniV3_USDC_USDT_Proxy.address
  );
  const UniV3Helper = await ethers.getContract("UniswapV3Helper");

  let usdt,
    dai,
    tusd,
    usdc,
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
    morphoAaveStrategy,
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
    UniV3PositionManager,
    UniV3_USDC_USDT_Pool,
    UniV3SwapRouter,
    mockStrategy,
    mockStrategyDAI;

  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(erc20Abi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
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

    UniV3PositionManager = await ethers.getContractAt(
      "INonfungiblePositionManager",
      addresses.mainnet.UniV3PositionManager
    );

    UniV3_USDC_USDT_Pool = await ethers.getContractAt(
      "IUniswapV3Pool",
      addresses.mainnet.UniV3_USDC_USDT_Pool
    );

    UniV3SwapRouter = await ethers.getContractAt(
      "ISwapRouter",
      addresses.mainnet.UniV3SwapRouter
    );
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockOGN");
    LUSD = await ethers.getContract("MockLUSD");
    ogv = await ethers.getContract("MockOGV");
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

    UniV3PositionManager = await ethers.getContract(
      "MockNonfungiblePositionManager"
    );
    UniV3_USDC_USDT_Pool = await ethers.getContract("MockUniswapV3Pool");
    mockStrategy = await ethers.getContract("MockStrategy");
    mockStrategyDAI = await ethers.getContract("MockStrategyDAI");
  }
  if (!isFork) {
    const assetAddresses = await getAssetAddresses(deployments);

    const sGovernor = await ethers.provider.getSigner(governorAddr);

    // Add TUSD in fixture, it is disabled by default in deployment
    await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD);

    // Enable capital movement
    await vault.connect(sGovernor).unpauseCapital();

    // Add Buyback contract as trustee
    await vault.connect(sGovernor).setTrusteeAddress(buyback.address);
  }

  const signers = await hre.ethers.getSigners();
  let governor = signers[1];
  const strategist = signers[0];
  const adjuster = signers[0];
  let operator = signers[3];
  let timelock;

  const [matt, josh, anna, domen, daniel, franck] = signers.slice(4);

  if (isFork) {
    governor = await impersonateAndFundContract(governorAddr);
    timelock = await impersonateAndFundContract(timelockAddr);
    operator = await impersonateAndFundContract(operatorAddr);
  }
  await fundAccounts();
  if (isFork) {
    for (const user of [josh, matt, anna, domen, daniel, franck]) {
      // Approve Vault to move funds
      for (const asset of [ousd, usdt, usdc, dai]) {
        await resetAllowance(asset, user, vault.address);
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
    operator,
    timelock,
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
    ogv,
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
    ognStaking,
    signedPayouts,
    compensationClaims,
    flipper,
    buyback,
    wousd,

    // Uniswap V3 Strategy
    UniV3PositionManager,
    UniV3_USDC_USDT_Pool,
    UniV3_USDC_USDT_Strategy,
    UniV3Helper,
    UniV3SwapRouter,
    mockStrategy,
    mockStrategyDAI,
  };
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
      .setNetOusdMintForStrategyThreshold(utils.parseUnits("50", 24));

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

  const { timelockAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(timelockAddr);

  if (isFork) {
    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoCompoundStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
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

  const { governorAddr, timelockAddr } = await getNamedAccounts();
  let sGovernor = await ethers.provider.getSigner(governorAddr);

  if (isFork) {
    sGovernor = await ethers.provider.getSigner(timelockAddr);

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdt.address,
        fixture.morphoAaveStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
      .setAssetDefaultStrategy(
        fixture.usdc.address,
        fixture.morphoAaveStrategy.address
      );

    await fixture.vault
      .connect(sGovernor)
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

async function impersonateAndFundContract(address) {
  await impersonateAccount(address);

  await hre.network.provider.send("hardhat_setBalance", [
    address,
    utils.parseEther("1000000").toHexString(),
  ]);

  return await ethers.provider.getSigner(address);
}

async function impersonateAndFundAddress(
  tokenAddress,
  contractAddresses,
  toAddress,
  balanceToUse = 30 // 30%
) {
  if (!Array.isArray(contractAddresses)) {
    contractAddresses = [contractAddresses];
  }

  for (const contractAddress of contractAddresses) {
    const impersonatedSigner = await impersonateAndFundContract(
      contractAddress
    );

    const tokenContract = await ethers.getContractAt(daiAbi, tokenAddress);

    const balance = await tokenContract
      .connect(impersonatedSigner)
      .balanceOf(contractAddress);
    await tokenContract
      .connect(impersonatedSigner)
      .transfer(toAddress, balance.mul(balanceToUse).div(100));
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
    utils.parseUnits("1000", 6)
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

  await oracleRouter.setFeed(
    evilDAI.address,
    oracleAddresses.chainlink.DAI_USD
  );
  await fixture.vault.connect(sGovernor).supportAsset(evilDAI.address);

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

  const encodedCallbackAddress = utils.defaultAbiCoder
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

function uniswapV3FixturSetup() {
  return deployments.createFixture(async () => {
    const fixture = await defaultFixture();

    const {
      usdc,
      usdt,
      dai,
      UniV3_USDC_USDT_Strategy,
      mockStrategy,
      mockStrategyDAI,
    } = fixture;

    if (!isFork) {
      // Approve mockStrategy
      await _approveStrategy(fixture, mockStrategy);
      await _approveStrategy(fixture, mockStrategyDAI);

      // Approve Uniswap V3 Strategy
      await _approveStrategy(fixture, UniV3_USDC_USDT_Strategy, true);
    }

    // Change default strategy to Uniswap V3 for both USDT and USDC
    await _setDefaultStrategy(fixture, usdc, UniV3_USDC_USDT_Strategy);
    await _setDefaultStrategy(fixture, usdt, UniV3_USDC_USDT_Strategy);

    if (!isFork) {
      // And a different one for DAI
      await _setDefaultStrategy(fixture, dai, mockStrategyDAI);
    }

    return fixture;
  });
}

async function _approveStrategy(fixture, strategy, isUniswapV3) {
  const { vault, harvester } = fixture;
  const { governorAddr, timelockAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(
    isFork ? timelockAddr : governorAddr
  );

  if (isUniswapV3) {
    await vault.connect(sGovernor).approveUniswapV3Strategy(strategy.address);
  } else {
    await vault.connect(sGovernor).approveStrategy(strategy.address);
  }

  await harvester
    .connect(sGovernor)
    .setSupportedStrategy(strategy.address, true);
}

async function _setDefaultStrategy(fixture, asset, strategy) {
  const { vault } = fixture;
  const { governorAddr, timelockAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(
    isFork ? timelockAddr : governorAddr
  );
  await vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(asset.address, strategy.address);
}

module.exports = {
  resetAllowance,
  defaultFixture,
  mockVaultFixture,
  compoundFixture,
  compoundVaultFixture,
  multiStrategyVaultFixture,
  threepoolFixture,
  threepoolVaultFixture,
  convexVaultFixture,
  convexMetaVaultFixture,
  convexGeneralizedMetaForkedFixture,
  convexLUSDMetaVaultFixture,
  morphoCompoundFixture,
  morphoAaveFixture,
  aaveVaultFixture,
  hackedVaultFixture,
  rebornFixture,
  uniswapV3FixturSetup,
  withImpersonatedAccount,
  impersonateAndFundContract,
  impersonateAccount,
};
