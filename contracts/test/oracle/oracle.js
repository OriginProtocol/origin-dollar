const { defaultFixture } = require("../_fixture");
const chai = require("chai");
const hre = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { utils } = require("ethers");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  getOracleAddresses,
  isFork,
} = require("../helpers");
const { expect } = require("chai");

/*
 * Because the oracle code is so tightly intergrated into the vault,
 * the actual tests for the core oracle features are just a part of the vault tests.
 *
 * These tests are just of the methods used by the DAPP UI.
 */

describe("Oracle read methods for DAPP", () => {
  it("should read the mint price", async () => {
    const { vault, usdt } = await loadFixture(defaultFixture);
    const tests = [
      ["0.80", "0.80"],
      ["1.00", "1.00"],
      ["1.05", "1.00"],
    ];
    for (const test of tests) {
      const [actual, expectedRead] = test;
      await setOracleTokenPriceUsd("USDT", actual);
      expect(await vault.priceUSDMint(usdt.address)).to.equal(
        ousdUnits(expectedRead)
      );
    }
  });

  it("should read the redeem price", async () => {
    const { vault, usdt } = await loadFixture(defaultFixture);
    const tests = [
      ["0.80", "1.00"],
      ["1.00", "1.00"],
      ["1.05", "1.05"],
    ];
    for (const test of tests) {
      const [actual, expectedRead] = test;
      await setOracleTokenPriceUsd("USDT", actual);
      expect(await vault.priceUSDRedeem(usdt.address)).to.equal(
        ousdUnits(expectedRead)
      );
    }
  });
});
