const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { ousdUnits, setOracleTokenPriceUsd } = require("../helpers");

/*
 * Because the oracle code is so tightly intergrated into the vault,
 * the actual tests for the core oracle features are just a part of the vault tests.
 */

describe("Oracle", async () => {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });
  describe("Oracle read methods for DAPP", () => {
    it("should read the mint price", async () => {
      const { vault, usdt } = fixture;
      const tests = [
        ["0.998", "0.998"],
        ["1.00", "1.00"],
        ["1.05", "1.00"],
      ];
      for (const test of tests) {
        const [actual, expectedRead] = test;
        await setOracleTokenPriceUsd("USDT", actual);
        expect(await vault.priceUnitMint(usdt.address)).to.equal(
          ousdUnits(expectedRead)
        );
      }
    });

    it("should fail below peg on the mint price", async () => {
      const { vault, usdt } = fixture;
      const prices = ["0.85", "0.997"];
      for (const price of prices) {
        await setOracleTokenPriceUsd("USDT", price);
        await expect(vault.priceUnitMint(usdt.address)).to.be.revertedWith(
          "Asset price below peg"
        );
      }
    });

    it("should read the redeem price", async () => {
      const { vault, usdt } = fixture;
      const tests = [
        ["0.80", "1.00"],
        ["1.00", "1.00"],
        ["1.05", "1.05"],
      ];
      for (const test of tests) {
        const [actual, expectedRead] = test;
        await setOracleTokenPriceUsd("USDT", actual);
        expect(await vault.priceUnitRedeem(usdt.address)).to.equal(
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
        const { vault, usdt } = fixture;
        await setOracleTokenPriceUsd("USDT", price);
        if (expectedRevert) {
          const tx = vault.priceUnitRedeem(usdt.address);
          await expect(tx).to.be.revertedWith(expectedRevert);
        } else {
          await vault.priceUnitRedeem(usdt.address);
        }
      });
    }
  });
});
