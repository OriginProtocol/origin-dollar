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

const loadFixture = createFixtureLoader(bre.provider, myWallets);

const isGanacheFork = bre.network.name === "fork";

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
};
