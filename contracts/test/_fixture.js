const bre = require("@nomiclabs/buidler");
const { getAssetAddresses, getOracleAddress } = require("../test/helpers.js");

const addresses = require("../utils/addresses");
const {
  usdtUnits,
  daiUnits,
  usdcUnits,
  tusdUnits,
  isGanacheFork,
} = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;
const tusdAbi = require("./abi/erc20.json");
const usdcAbi = require("./abi/erc20.json");

async function defaultFixture() {
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  await deployments.fixture();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const viewVault = await ethers.getContractAt("IViewVault", vaultProxy.address);
  const timelock = await ethers.getContract("Timelock");
  const compoundStrategy = await ethers.getContract("CompoundStrategy");

  let usdt, dai, tusd, usdc, nonStandardToken;
  let mixOracle, mockOracle, chainlinkOracle, chainlinkOracleFeedETH, chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT, chainlinkOracleFeedUSDC, chainlinkOracleFeedTUSD,
    chainlinkOracleFeedNonStandardToken
  if (isGanacheFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");

    // Oracle related fixtures.
    const chainlinkOracleAddress = (await ethers.getContract("ChainlinkOracle")).address;
    chainlinkOracle = await ethers.getContractAt("IViewEthUsdOracle", chainlinkOracleAddress)

    chainlinkOracleFeedETH = await ethers.getContract("MockChainlinkOracleFeedETH");
    chainlinkOracleFeedDAI = await ethers.getContract("MockChainlinkOracleFeedDAI");
    chainlinkOracleFeedUSDT = await ethers.getContract("MockChainlinkOracleFeedUSDT");
    chainlinkOracleFeedUSDC = await ethers.getContract("MockChainlinkOracleFeedUSDC");
    chainlinkOracleFeedTUSD = await ethers.getContract("MockChainlinkOracleFeedTUSD");
    chainlinkOracleFeedNonStandardToken = await ethers.getContract("MockChainlinkOracleFeedNonStandardToken");

    const mixOracleAddress = (await ethers.getContract("MixOracle")).address;
    mixOracle = await ethers.getContractAt("IViewMinMaxOracle", mixOracleAddress)

    // Note: the MockOracle contract is no longer used for testing the oracle functionality.
    // It is replaced by MixOracle. But we keep it around since it is still used for testing TimeLock.
    mockOracle = await ethers.getContract("MockOracle");
  }

  const cOracle = await ethers.getContract("ChainlinkOracle");
  const assetAddresses = await getAssetAddresses(deployments);

  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  // Add TUSD in fixture, it is disabled by default in deployment
  await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD);
  await cOracle.connect(sDeployer).registerFeed(chainlinkOracleFeedTUSD.address, "TUSD", false);

  if (nonStandardToken) {
    await vault.connect(sGovernor).supportAsset(nonStandardToken.address);
    await cOracle.connect(sDeployer).registerFeed(chainlinkOracleFeedNonStandardToken.address, "NonStandardToken", false);
  }

  const signers = await bre.ethers.getSigners();
  const governor = signers[2];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  const binanceSigner = await ethers.provider.getSigner(
    addresses.mainnet.Binance
  );

  // Give everyone coins
  for (const user of users) {
    if (isGanacheFork) {
      // Fund from Binance account on Mainnet fork
      await dai
        .connect(binanceSigner)
        .transfer(await user.getAddress(), daiUnits("1000"));
      await usdc
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdcUnits("1000"));
      await usdt
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdtUnits("1000"));
      await tusd
        .connect(binanceSigner)
        .transfer(await user.getAddress(), tusdUnits("1000"));
    } else {
      await dai.connect(user).mint(daiUnits("1000"));
      await usdc.connect(user).mint(usdcUnits("1000"));
      await usdt.connect(user).mint(usdtUnits("1000"));
      await tusd.connect(user).mint(tusdUnits("1000"));
      await nonStandardToken.connect(user).mint(usdtUnits("1000"));
    }
  }

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    await dai.connect(user).approve(vault.address, daiUnits("100"));
    await vault.connect(user).mint(dai.address, daiUnits("100"));
  }

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
    // Oracle
    mixOracle,
    mockOracle,
    chainlinkOracle,
    chainlinkOracleFeedETH,
    chainlinkOracleFeedDAI,
    chainlinkOracleFeedUSDT,
    chainlinkOracleFeedUSDC,
    chainlinkOracleFeedTUSD,
    chainlinkOracleFeedNonStandardToken,
    timelock,
    compoundStrategy,
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
    nonStandardToken,
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
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);

  const { governorAddr, proxyAdminAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sProxyAdmin = ethers.provider.getSigner(proxyAdminAddr);

  // Initialize the MockVault
  await cMockVault
    .connect(sGovernor)
    .initialize(await getOracleAddress(deployments), cOUSD.address);

  // Configure supported assets
  const assetAddresses = await getAssetAddresses(deployments);
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.DAI);
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDT);
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDC);
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.TUSD);
  if (assetAddresses.NonStandardToken) {
    await cMockVault
      .connect(sGovernor)
      .supportAsset(assetAddresses.NonStandardToken);
  }

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sProxyAdmin).upgradeTo(cMockVault.address);

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
    .addStrategy(fixture.compoundStrategy.address, 100);

  return fixture;
}

module.exports = {
  defaultFixture,
  mockVaultFixture,
  compoundVaultFixture,
};
