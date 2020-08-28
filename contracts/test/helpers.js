const bre = require("@nomiclabs/buidler");
const chai = require("chai");
const { parseUnits } = require("ethers").utils;
const { createFixtureLoader } = require("ethereum-waffle");

const addresses = require("../utils/addresses");

chai.Assertion.addMethod("approxEqual", function (expected, message) {
  const actual = this._obj;
  chai.expect(actual, message).gt(expected.mul("999").div("1000"));
  chai.expect(actual, message).lt(expected.mul("1001").div("1000"));
});

chai.Assertion.addMethod("approxBalanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  const actual = await contract.balanceOf(user.getAddress());
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.approxEqual(expected, message);
});

chai.Assertion.addMethod("balanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  const actual = await contract.balanceOf(user.getAddress());
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.equal(expected, message);
});

const DECIMAL_CACHE = {};
async function decimalsFor(contract) {
  if (DECIMAL_CACHE[contract.address] != undefined) {
    return DECIMAL_CACHE[contract.address];
  }
  let decimals = await contract.decimals();
  if (decimals.toNumber) {
    decimals = decimals.toNumber();
  }
  DECIMAL_CACHE[contract.address] = decimals;
  return decimals;
}

function ousdUnits(amount) {
  return parseUnits(amount, 18);
}

function usdtUnits(amount) {
  return parseUnits(amount, 6);
}

function usdcUnits(amount) {
  return parseUnits(amount, 6);
}

function tusdUnits(amount) {
  return parseUnits(amount, 18);
}

function daiUnits(amount) {
  return parseUnits(amount, 18);
}

function ethUnits(amount) {
  return parseUnits(amount, 18);
}

function oracleUnits(amount) {
  return parseUnits(amount, 6);
}

async function expectApproxSupply(contract, expected, message) {
  const balance = await contract.totalSupply();
  chai.expect(balance, message).gt(expected.mul("999").div("1000"));
  chai.expect(balance, message).lt(expected.mul("1001").div("1000"));
}

const isGanacheFork = bre.network.name === "ganache";

// The coverage network soliditycoverage uses Ganache
const isGanache = isGanacheFork || bre.network.name === "soliditycoverage";

const isMainnetOrFork = isGanacheFork || bre.network.name === "mainnet";

// Fixture loader that is compatible with Ganache
const loadFixture = isGanache
  ? createFixtureLoader(
      [
        bre.ethers.provider.getSigner(0),
        bre.ethers.provider.getSigner(1),
        bre.ethers.provider.getSigner(2),
        bre.ethers.provider.getSigner(3),
        bre.ethers.provider.getSigner(4),
        bre.ethers.provider.getSigner(5),
        bre.ethers.provider.getSigner(6),
        bre.ethers.provider.getSigner(7),
        bre.ethers.provider.getSigner(8),
        bre.ethers.provider.getSigner(9),
      ],
      bre.ethers.provider
    )
  : waffle.loadFixture;

const advanceTime = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

const getOracleAddress = async (deployments) => {
  if (isMainnetOrFork) {
    return addresses.mainnet.Oracle;
  } else {
    return (await deployments.get("MockOracle")).address;
  }
};

const getAssetAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    return {
      USDT: addresses.mainnet.USDT,
      USDC: addresses.mainnet.USDC,
      TUSD: addresses.mainnet.TUSD,
      DAI: addresses.mainnet.DAI,
      cDAI: addresses.mainnet.cDAI,
      cUSDC: addresses.mainnet.cUSDC,
      cUSDT: addresses.mainnet.cUSDT,
    };
  } else {
    return {
      USDT: (await deployments.get("MockUSDT")).address,
      USDC: (await deployments.get("MockUSDC")).address,
      TUSD: (await deployments.get("MockTUSD")).address,
      DAI: (await deployments.get("MockDAI")).address,
      cDAI: (await deployments.get("MockCDAI")).address,
      cUSDC: (await deployments.get("MockCUSDC")).address,
      cUSDT: (await deployments.get("MockCUSDT")).address,
    };
  }
};

module.exports = {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  tusdUnits,
  daiUnits,
  ethUnits,
  oracleUnits,
  expectApproxSupply,
  advanceTime,
  isGanacheFork,
  isMainnetOrFork,
  loadFixture,
  getOracleAddress,
  getAssetAddresses,
};
