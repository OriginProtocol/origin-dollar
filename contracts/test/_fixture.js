const bre = require("@nomiclabs/buidler");

const addresses = require("../utils/addresses");
const fundAccounts = require("../utils/funding");
const {
  getAssetAddresses,
  daiUnits,
  usdcUnits,
  usdtUnits,
  isGanacheFork,
} = require("./helpers");
const { utils } = require("ethers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const tusdAbi = require("./abi/erc20.json");
const usdcAbi = require("./abi/erc20.json");
const compAbi = require("./abi/erc20.json");

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
  const viewVault = await ethers.getContractAt(
    "IViewVault",
    vaultProxy.address
  );
  const timelock = await ethers.getContract("Timelock");
  const minuteTimelock = await ethers.getContract("MinuteTimelock");
  const governorContract = await ethers.getContract("Governor");
  const CompoundStrategyFactory = await ethers.getContractFactory(
    "CompoundStrategy"
  );
  const compoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    compoundStrategyProxy.address
  );
  const rebaseHooks = await ethers.getContract("RebaseHooks");

  // const threePoolStrategy = await ethers.getContractAt("ThreePoolStrategy");

  let usdt, dai, tusd, usdc, nonStandardToken, cusdt, cdai, cusdc, comp;
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
    viewOpenUniswapOracle,
    uniswapPairDAI_ETH,
    uniswapPairUSDC_ETH,
    uniswapPairUSDT_ETH,
    threePool,
    threePoolToken;

  if (isGanacheFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
    comp = await ethers.getContractAt(compAbi, addresses.mainnet.COMP);
    // TODO add mainnet threePool
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");

    cdai = await ethers.getContract("MockCDAI");
    cusdt = await ethers.getContract("MockCUSDT");
    cusdc = await ethers.getContract("MockCUSDC");
    comp = await ethers.getContract("MockCOMP");

    threePool = await ethers.getContract("3Pool");
    threePoolToken = await ethers.getContract("Mock3PoolToken");

    // Oracle related fixtures.
    uniswapPairDAI_ETH = await ethers.getContract("MockUniswapPairDAI_ETH");
    uniswapPairUSDC_ETH = await ethers.getContract("MockUniswapPairUSDC_ETH");
    uniswapPairUSDT_ETH = await ethers.getContract("MockUniswapPairUSDT_ETH");
    openUniswapOracle = await ethers.getContract("OpenUniswapOracle");
    viewOpenUniswapOracle = await ethers.getContractAt(
      "IViewEthUsdOracle",
      openUniswapOracle.address
    );

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
    mixOracle = await ethers.getContractAt(
      "IViewMinMaxOracle",
      mixOracleAddress
    );

    // MockOracle mocks the open oracle interface,
    // and is used by the MixOracle.
    mockOracle = await ethers.getContract("MockOracle");
    openOracle = mockOracle;
  }

  const cOracle = await ethers.getContract("ChainlinkOracle");
  const assetAddresses = await getAssetAddresses(deployments);

  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add TUSD in fixture, it is disabled by default in deployment
  await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD);

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

  const signers = await bre.ethers.getSigners();
  const governor = signers[1];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];

  await fundAccounts();

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    await dai.connect(user).approve(vault.address, daiUnits("100"));
    await vault.connect(user).mint(dai.address, daiUnits("100"));
  }

  //Matt does an initial mint of 3Pool, so the threePool contract is functional
  await dai.connect(matt).mint(daiUnits("1000000"));
  await usdc.connect(matt).mint(usdcUnits("1200000"));
  await usdt.connect(matt).mint(usdtUnits("1600000"));
  await dai.connect(matt).approve(threePool.address, daiUnits("1000000"));
  await usdc.connect(matt).approve(threePool.address, usdcUnits("1200000"));
  await usdt.connect(matt).approve(threePool.address, usdtUnits("1600000"));
  // First mint must be equal sized
  await threePool
    .connect(matt)
    .add_liquidity(
      [daiUnits("1000000"), usdcUnits("1000000"), usdtUnits("1000000")],
      daiUnits("0")
    );
  // But we really want different amounts of each coin on 3pool, since
  // that's easier to reason about and more realistic.
  await threePool
    .connect(matt)
    .add_liquidity(
      [daiUnits("0"), usdcUnits("100000"), usdtUnits("200000")],
      daiUnits("0")
    );

  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    // Contracts
    ousd,
    vault,
    viewVault,
    rebaseHooks,
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
    viewOpenUniswapOracle,
    uniswapPairDAI_ETH,
    uniswapPairUSDC_ETH,
    uniswapPairUSDT_ETH,
    timelock,
    minuteTimelock,
    governorContract,
    compoundStrategy,
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
    nonStandardToken,

    // cTokens
    cdai,
    cusdc,
    cusdt,
    comp,

    // CompoundStrategy contract factory to deploy
    CompoundStrategyFactory,

    // ThreePool
    threePool,
    threePoolToken,
    // threePoolStrategy
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

  await fixture.vault
    .connect(sGovernor)
    .addStrategy(fixture.compoundStrategy.address, utils.parseUnits("1", 18));

  return fixture;
}

/**
 * Configure a Vault with only the 3Pool strategy.
 */
async function compoundVaultFixture() {
  const fixture = await defaultFixture();

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await fixture.vault
    .connect(sGovernor)
    .addStrategy(fixture.compoundStrategy.address, utils.parseUnits("1", 18));

  // Do the initial 3pool transaction
  const { usdt, usdc, dai, matt } = await loadFixture(compoundFixture);

  await dai.connect(matt).approve(threePool.address, daiUnits("100"));
  await usdc.connect(matt).approve(threePool.address, usdcUnits("100"));
  await usdt.connect(matt).approve(threePool.address, usdtUnits("100"));

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
  //
  // Initialize the secons strategy with only DAI
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
  await fixture.vault
    .connect(sGovernor)
    .addStrategy(cStrategyTwo.address, utils.parseUnits("1", 18));

  // Set strategy weights to 5e17 each (50%)
  await fixture.vault
    .connect(sGovernor)
    .setStrategyWeights(
      [fixture.compoundStrategy.address, cStrategyTwo.address],
      [utils.parseUnits("5", 17), utils.parseUnits("5", 17)]
    );

  fixture.strategyTwo = cStrategyTwo;

  return fixture;
}

module.exports = {
  defaultFixture,
  mockVaultFixture,
  compoundFixture,
  compoundVaultFixture,
  multiStrategyVaultFixture,
};
