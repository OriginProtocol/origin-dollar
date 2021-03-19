const { defaultFixture } = require("../_fixture");

const {
  ousdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
} = require("../helpers");
const { expect } = require("chai");

/*
 * Because the oracle code is so tightly intergrated into the vault,
 * the actual tests for the core oracle features are just a part of the vault tests.
 */

describe("Oracle", async () => {
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

  describe("Min/Max Drift", async () => {
    const tests = [
      ["0.10", "Oracle: Price under min"],
      ["0.699", "Oracle: Price under min"],
      ["0.70"],
      ["0.98"],
      ["1.00"],
      ["1.04"],
      ["1.30"],
      ["1.31", "Oracle: Price exceeds max"],
      ["6.00", "Oracle: Price exceeds max"],
    ];

    for (const test of tests) {
      const [price, expectedRevert] = test;
      const revertLabel = expectedRevert ? "revert" : "not revert";
      const label = `Should ${revertLabel} because of drift at $${price}`;
      it(label, async () => {
        const { vault, usdt } = await loadFixture(defaultFixture);
        await setOracleTokenPriceUsd("USDT", price);
        if (expectedRevert) {
          const tx = vault.priceUSDRedeem(usdt.address);
          await expect(tx).to.be.revertedWith(expectedRevert);
        } else {
          await vault.priceUSDRedeem(usdt.address);
        }
      });
    }
  });
});
