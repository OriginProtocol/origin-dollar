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
  await deployments.fixture();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const timelock = await ethers.getContract("Timelock");

  let usdt, dai, tusd, usdc, oracle;
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
  }

  const signers = await ethers.getSigners();
  const governor = signers[2];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  const binanceSigner = ethers.provider.getSigner(addresses.mainnet.Binance);

  // Unpause deposits
  await vault.connect(governor).unpauseDeposits();

  // Give everyone USDC and DAI
  for (const user of users) {
    if (isGanacheFork) {
      // Fund from Binance account on Mainnet fork
      dai
        .connect(binanceSigner)
        .transfer(await user.getAddress(), daiUnits("1000"));
      usdc
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdcUnits("1000"));
      usdt
        .connect(binanceSigner)
        .transfer(await user.getAddress(), usdtUnits("1000"));
      tusd
        .connect(binanceSigner)
        .transfer(await user.getAddress(), tusdUnits("1000"));
    } else {
      dai.connect(user).mint(daiUnits("1000"));
      usdc.connect(user).mint(usdcUnits("1000"));
      usdt.connect(user).mint(usdtUnits("1000"));
      tusd.connect(user).mint(tusdUnits("1000"));
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
    // Assets
    usdt,
    dai,
    tusd,
    usdc,
  };
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  // Initialize and configure MockVault
  const cMockVault = await ethers.getContract("MockVault");
  const cOUSD = await ethers.getContract("OUSD");

  const { governorAddr, proxyAdminAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sProxyAdmin = ethers.provider.getSigner(proxyAdminAddr);

  // Initialize the MockVault
  await cMockVault
    .connect(sGovernor)
    .initialize(await getOracleAddress(deployments), cOUSD.address);

  // Configure supported assets
  const assetAddresses = await getAssetAddresses(deployments);
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.DAI, "DAI");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDT, "USDT");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.USDC, "USDC");
  await cMockVault.connect(sGovernor).supportAsset(assetAddresses.TUSD, "TUSD");

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");
  await cVaultProxy.connect(sProxyAdmin).upgradeTo(cMockVault.address);

  return {
    ...defaultFixture(),
    vault: await ethers.getContractAt("MockVault", cVaultProxy.address),
  };
}

module.exports = {
  defaultFixture,
  mockVaultFixture,
};
