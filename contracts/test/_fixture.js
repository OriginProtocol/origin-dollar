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

async function defaultFixture() {
  const { governorAddr } = await getNamedAccounts();

  await deployments.fixture();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const timelock = await ethers.getContract("Timelock");
  const compoundStrategy = await ethers.getContract("CompoundStrategy");

  let usdt, dai, tusd, usdc, oracle, nonStandardToken;
  if (isGanacheFork) {
    usdt = await ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await ethers.getContractAt(daiAbi, addresses.mainnet.TUSD);
    usdc = await ethers.getContractAt(daiAbi, addresses.mainnet.USDC);
  } else {
    usdt = await ethers.getContract("MockUSDT");
    dai = await ethers.getContract("MockDAI");
    tusd = await ethers.getContract("MockTUSD");
    usdc = await ethers.getContract("MockUSDC");
    oracle = await ethers.getContract("MockOracle");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  const assetAddresses = await getAssetAddresses(deployments);
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add TUSD in fixture, it is disabled by default in deployment
  await vault.connect(sGovernor).supportAsset(assetAddresses.TUSD, "TUSD");
  if (nonStandardToken) {
    await vault
      .connect(sGovernor)
      .supportAsset(nonStandardToken.address, "NonStandardToken");
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

  // Give everyone USDC and DAI
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
    oracle,
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
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.DAI, "DAI");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDT, "USDT");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDC, "USDC");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.TUSD, "TUSD");
  if (assetAddresses.NonStandardToken) {
    await cMockVault
      .connect(sGovernor)
      .supportAsset(assetAddresses.NonStandardToken, "NonStandardToken");
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
