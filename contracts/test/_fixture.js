const addresses = require("../utils/addresses");
const { usdtUnits, daiUnits, isGanacheFork } = require("./helpers");

const daiAbi = require("./abi/dai.json").abi;
const usdtAbi = require("./abi/usdt.json").abi;

/* Fixtures for running tests without mainnet fork. Uses mocked contracts.
 */
async function defaultFixture() {
  await deployments.fixture();
  if (isGanacheFork) {
    return forkFixture();
  } else {
    return buidlerEvmFixture();
  }
}

async function buidlerEvmFixture() {
  const ousd = await ethers.getContract("OUSD");
  const vault = await ethers.getContract("Vault");
  const usdt = await ethers.getContract("MockUSDT");
  const dai = await ethers.getContract("MockDAI");

  const oracle = await ethers.getContract("MockOracle");

  const signers = await ethers.getSigners();
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  // Give everyone USDT and DAI
  for (const user of users) {
    usdt.connect(user).mint(usdtUnits("1000.0"));
    dai.connect(user).mint(daiUnits("1000.0"));
  }

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    // Approve 100 USDT transfer
    await usdt.connect(user).approve(vault.address, usdtUnits("100.0"));
    // Mint 100 OUSD from 100 USDT
    await vault.connect(user).depositAndMint(usdt.address, usdtUnits("100.0"));
  }

  return {
    matt,
    josh,
    anna,
    ousd,
    vault,
    oracle,
    usdt,
    dai,
  };
}

/* Account setup for mainnet fork. Uses an unlocked Binance account to fund
 * users. Uses real contracts instead of mocks.
 */

async function forkFixture() {
  const ousd = await ethers.getContract("OUSD");
  const vault = await ethers.getContract("Vault");

  const binanceSigner = ethers.provider.getSigner(addresses.mainnet.Binance);
  const usdt = await ethers.getContractAt(
    usdtAbi,
    addresses.mainnet.USDT,
    binanceSigner
  );
  const dai = await ethers.getContractAt(
    daiAbi,
    addresses.mainnet.DAI,
    binanceSigner
  );

  const signers = await ethers.getSigners();
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];
  const users = [matt, josh, anna];

  // Give everyone USDT and DAI courtesy of Binance
  for (const user of users) {
    dai.transfer(await user.getAddress(), daiUnits("100"));
    usdt.transfer(await user.getAddress(), usdtUnits("100"));
  }

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    // Approve 100 USDT transfer
    await usdt.connect(user).approve(vault.address, usdtUnits("100.0"));
    // Mint 100 OUSD from 100 USDT
    await vault.connect(user).depositAndMint(usdt.address, usdtUnits("100.0"));
  }

  return {
    matt,
    josh,
    anna,
    ousd,
    vault,
    usdt,
    dai,
  };
}

module.exports = {
  defaultFixture,
  forkFixture,
};
