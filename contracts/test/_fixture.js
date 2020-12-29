const hre = require("hardhat");

const addresses = require("../utils/addresses");
const fundAccounts = require("../utils/funding");
const { getAssetAddresses, daiUnits, isFork } = require("./helpers");
const { utils } = require("ethers");

const { airDropPayouts } = require("../scripts/staking/airDrop.js");
const testPayouts = require("../scripts/staking/testPayouts.json");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const tusdAbi = require("./abi/erc20.json");
const usdcAbi = require("./abi/erc20.json");
const compAbi = require("./abi/erc20.json");
const crvAbi = require("./abi/erc20.json");
const ognAbi = require("./abi/erc20.json");
const crvMinterAbi = require("./abi/crvMinter.json");

async function defaultFixture() {
  const { governorAddr } = await getNamedAccounts();

  await deployments.fixture();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");
  const compoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
  const governorContract = await ethers.getContract("Governor");
  const CompoundStrategyFactory = await ethers.getContractFactory(
    "CompoundStrategy"
  );
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundStrategyProxy.address
  );

  const curveUSDTStrategyProxy = await ethers.getContract(
    "CurveUSDTStrategyProxy"
  );
  const curveUSDTStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDTStrategyProxy.address
  );

  const curveUSDCStrategyProxy = await ethers.getContract(
    "CurveUSDCStrategyProxy"
  );
  const curveUSDCStrategy = await ethers.getContractAt(
    "ThreePoolStrategy",
    curveUSDCStrategyProxy.address
  );

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const aaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    aaveStrategyProxy.address
  );

  const liquidityRewardOUSD_USDT = await ethers.getContractAt(
    "LiquidityReward",
    (await ethers.getContract("LiquidityRewardOUSD_USDTProxy")).address
  );

  const ognStaking = await ethers.getContractAt(
    "SingleAssetStaking",
    (await ethers.getContract("OGNStakingProxy")).address
  );

  const signedPayouts = await airDropPayouts(ognStaking.address, testPayouts);

  const compensationClaims = await ethers.getContract("CompensationClaims");

  let usdt,
    dai,
    tusd,
    usdc,
    ogn,
    nonStandardToken,
    cusdt,
    cdai,
    cusdc,
    comp,
    adai,
    mockNonRebasing,
    mockNonRebasingTwo;

  let mixOracle,
    mockOracle,
    openOracle,
    chainlinkOracle,
    chainlinkOracleFeedETH,
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedTUSD,
    chainlinkOracleFeedNonStandardToken,
    openUniswapOracle,
    uniswapPairDAI_ETH,
    uniswapPairUSDC_ETH,
    uniswapPairUSDT_ETH,
    crv,
    crvMinter,
    threePool,
    threePoolToken,
    threePoolGauge,
    aaveAddressProvider,
    uniswapPairOUSD_USDT;

  if (isFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
    comp = await ethers.getContractAt(compAbi, addresses.mainnet.COMP);
    crv = await ethers.getContractAt(crvAbi, addresses.mainnet.CRV);
    ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);
    crvMinter = await ethers.getContractAt(
      crvMinterAbi,
      addresses.mainnet.CRVMinter
    );
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      addresses.mainnet.AAVE_ADDRESS_PROVIDER
    );
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    ogn = await ethers.getContract("MockOGN");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");

    cdai = await ethers.getContract("MockCDAI");
    cusdt = await ethers.getContract("MockCUSDT");
    cusdc = await ethers.getContract("MockCUSDC");
    comp = await ethers.getContract("MockCOMP");

    crv = await ethers.getContract("MockCRV");
    crvMinter = await ethers.getContract("MockCRVMinter");
    threePool = await ethers.getContract("MockCurvePool");
    threePoolToken = await ethers.getContract("Mock3CRV");
    threePoolGauge = await ethers.getContract("MockCurveGauge");

    adai = await ethers.getContract("MockADAI");

    const aave = await ethers.getContract("MockAave");
    // currently in test the mockAave is itself the address provder
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      aave.address
    );

    uniswapPairOUSD_USDT = await ethers.getContract("MockUniswapPairOUSD_USDT");

    // Oracle related fixtures.
    uniswapPairDAI_ETH = await ethers.getContract("MockUniswapPairDAI_ETH");
    uniswapPairUSDC_ETH = await ethers.getContract("MockUniswapPairUSDC_ETH");
    uniswapPairUSDT_ETH = await ethers.getContract("MockUniswapPairUSDT_ETH");

    const chainlinkOracleAddress = (await ethers.getContract("ChainlinkOracle"))
      .address;
    chainlinkOracle = await ethers.getContractAt(
      "IViewEthUsdOracle",
      chainlinkOracleAddress
    );

    chainlinkOracleFeedETH = await ethers.getContract(
      "MockChainlinkOracleFeedETH"
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
    chainlinkOracleFeedTUSD = await ethers.getContract(
      "MockChainlinkOracleFeedTUSD"
    );
    chainlinkOracleFeedNonStandardToken = await ethers.getContract(
      "MockChainlinkOracleFeedNonStandardToken"
    );

    const mixOracleAddress = (await ethers.getContract("MixOracle")).address;
    mixOracle = await ethers.getContractAt("IMinMaxOracle", mixOracleAddress);

    // MockOracle mocks the open oracle interface,
    // and is used by the MixOracle.
    mockOracle = await ethers.getContract("MockOracle");
    openOracle = mockOracle;

    // Mock contracts for testing rebase opt out
    mockNonRebasing = await ethers.getContract("MockNonRebasing");
    await mockNonRebasing.setOUSD(ousd.address);
    mockNonRebasingTwo = await ethers.getContract("MockNonRebasingTwo");
    await mockNonRebasingTwo.setOUSD(ousd.address);
  }

  const cOracle = await ethers.getContract("ChainlinkOracle");
  const assetAddresses = await getAssetAddresses(deployments);

  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Add TUSD in fixture, it is disabled by default in deployment
  await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD);

  // Enable capital movement
  await vault.connect(sGovernor).unpauseCapital();

  await cOracle
    .connect(sGovernor)
    .registerFeed(chainlinkOracleFeedTUSD.address, "TUSD", false);

  //need to register now
  const mainOracle = await ethers.getContract("MixOracle");
  await mainOracle
    .connect(sGovernor)
    .registerTokenOracles("TUSD", [cOracle.address], []);

  if (nonStandardToken) {
    await cOracle
      .connect(sGovernor)
      .registerFeed(
        chainlinkOracleFeedNonStandardToken.address,
        "NonStandardToken",
        false
      );
    await mainOracle
      .connect(sGovernor)
      .registerTokenOracles("NonStandardToken", [cOracle.address], []);
  }

  const signers = await hre.ethers.getSigners();
  const governor = signers[1];
  const adjuster = signers[0];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];

  await fundAccounts();

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    await dai.connect(user).approve(vault.address, daiUnits("100"));
    await vault.connect(user).mint(dai.address, daiUnits("100"), 0);
  }

  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    adjuster,
    // Contracts
    ousd,
    vault,
    mockNonRebasing,
    mockNonRebasingTwo,
    // Oracle
    mixOracle,
    mockOracle,
    openOracle,
    chainlinkOracle,
    chainlinkOracleFeedETH,
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedTUSD,
    chainlinkOracleFeedNonStandardToken,
    openUniswapOracle,
    uniswapPairDAI_ETH,
    uniswapPairUSDC_ETH,
    uniswapPairUSDT_ETH,
    governorContract,
    compoundStrategy,
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
    ogn,
    nonStandardToken,
    // cTokens
    cdai,
    cusdc,
    cusdt,
    comp,
    // aTokens,
    adai,
    // CompoundStrategy contract factory to deploy
    CompoundStrategyFactory,
    // ThreePool
    crv,
    crvMinter,
    threePool,
    threePoolGauge,
    threePoolToken,
    curveUSDTStrategy,
    curveUSDCStrategy,
    aaveStrategy,
    aaveAddressProvider,
    uniswapPairOUSD_USDT,
    liquidityRewardOUSD_USDT,
    ognStaking,
    signedPayouts,
    compensationClaims,
  };
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  const fixture = await defaultFixture();

  // Initialize and configure MockVault
  const cMockVault = await ethers.getContract("MockVault");

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // There is no need to initialize and setup the mock vault because the
  // proxy itself is already setup and the proxy is the one with the storage

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sGovernor).upgradeTo(cMockVault.address);

  return {
    ...fixture,
    vault: await ethers.getContractAt("MockVault", cVaultProxy.address),
  };
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
  // Add 3Pool USDT
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.curveUSDTStrategy.address);
  // Set direct allocation of USDT to the Strategy
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdt.address,
      fixture.curveUSDTStrategy.address
    );
  // Add 3Pool USDC
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.curveUSDCStrategy.address);
  // Set direct allocation of USDC to the Strategy
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.usdc.address,
      fixture.curveUSDCStrategy.address
    );

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
  // Add direct allocation of DAI to Aave
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(fixture.dai.address, fixture.aaveStrategy.address);
  return fixture;
}

/**
 * Configure a compound fixture with a false valt for testing
 */
async function compoundFixture() {
  const { deploy } = deployments;
  const fixture = await defaultFixture();

  const assetAddresses = await getAssetAddresses(deployments);

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
    assetAddresses.COMP,
    [assetAddresses.DAI, assetAddresses.USDC],
    [assetAddresses.cDAI, assetAddresses.cUSDC]
  );

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
  const { deploy } = deployments;
  const fixture = await defaultFixture();
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StandaloneThreePool", {
    from: governorAddr,
    contract: "ThreePoolStrategy",
  });

  fixture.tpStandalone = await ethers.getContract("StandaloneThreePool");

  // Set governor as vault
  await fixture.tpStandalone
    .connect(sGovernor)
    ["initialize(address,address,address,address,address,address,address)"](
      assetAddresses.ThreePool,
      governorAddr, // Using Governor in place of Vault here
      assetAddresses.CRV,
      assetAddresses.USDT,
      assetAddresses.ThreePoolToken,
      assetAddresses.ThreePoolGauge,
      assetAddresses.CRVMinter
    );

  return fixture;
}

/**
 * Configure a Vault with two strategies
 */
async function multiStrategyVaultFixture() {
  const { deploy } = deployments;
  const fixture = await compoundVaultFixture();
  const assetAddresses = await getAssetAddresses(deployments);
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
      assetAddresses.COMP,
      [assetAddresses.DAI, assetAddresses.USDC],
      [assetAddresses.cDAI, assetAddresses.cUSDC]
    );
  // Add second strategy to Vault
  await fixture.vault.connect(sGovernor).approveStrategy(cStrategyTwo.address);
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
      assetAddresses.COMP,
      [assetAddresses.DAI],
      [assetAddresses.cDAI]
    );

  fixture.strategyTwo = cStrategyTwo;
  fixture.strategyThree = cStrategyThree;
  return fixture;
}

/**
 * Configure a hacked Vault
 */
async function hackedVaultFixture() {
  const { deploy } = deployments;
  const fixture = await defaultFixture();
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const { vault } = fixture;

  await deploy("MockEvilDAI", {
    from: governorAddr,
    args: [vault.address, assetAddresses.DAI],
  });

  const evilDAI = await ethers.getContract("MockEvilDAI");

  await fixture.vault.connect(sGovernor).supportAsset(evilDAI.address);

  fixture.evilDAI = evilDAI;

  return fixture;
}

module.exports = {
  defaultFixture,
  mockVaultFixture,
  compoundFixture,
  compoundVaultFixture,
  multiStrategyVaultFixture,
  threepoolFixture,
  threepoolVaultFixture,
  aaveVaultFixture,
  hackedVaultFixture,
};
