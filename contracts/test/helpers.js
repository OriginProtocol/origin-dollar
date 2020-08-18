const bre = require("@nomiclabs/buidler");
const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;
const { createFixtureLoader } = require("ethereum-waffle");

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

function usdUnits(amount) {
  return parseUnits(amount, 6);
}

async function expectBalance(contract, user, expected, message) {
  expect(await contract.balanceOf(user.getAddress()), message).to.equal(
    expected
  );
}

const isGanacheFork = bre.network.name === "ganache";

const isMainnetOrFork = isGanacheFork || bre.network.name === "mainnet";

const loadFixture = isGanacheFork
  ? createFixtureLoader(bre.ethers.provider, [
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
    ])
  : waffle.loadFixture;

module.exports = {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  tusdUnits,
  daiUnits,
  ethUnits,
  usdUnits,
  expectBalance,
  isGanacheFork,
  isMainnetOrFork,
  loadFixture,
};
