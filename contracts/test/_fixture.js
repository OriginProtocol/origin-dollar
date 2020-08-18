const { deployments } = require("@nomiclabs/buidler");

const { usdtUnits, daiUnits, isGanacheFork } = require("./helpers");

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

async function forkFixture() {
  const ousd = await ethers.getContract("OUSD");

  return {
    ousd,
  };
}

module.exports = {
  defaultFixture,
  forkFixture,
};
