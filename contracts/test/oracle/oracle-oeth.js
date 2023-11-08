const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { parseUnits } = require("ethers/lib/utils");
const { impersonateAndFund } = require("../../utils/signers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");

/*
 * Because the oracle code is so tightly integrated into the vault,
 * the actual tests for the core oracle features are just a part of the vault tests.
 */

const maxVaultPrice = parseUnits("0.995");

describe("OETH Oracle", async () => {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.oethOracle,
  }));

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.oethOracleUpdater,
  }));

  const assetAddPrice = async (prices) => {
    const { anna, oethOracle, oethOracleUpdater } = fixture;
    const { vaultPrice, marketPrice, expectPrice, expectedVaultPrice } = prices;

    const vault = await ethers.getContract("MockVault");
    await vault.setFloorPrice(vaultPrice);

    const curvePool = await ethers.getContract("MockCurveOethEthPool");
    await curvePool.setOraclePrice(marketPrice);

    const tx = await oethOracleUpdater
      .connect(anna)
      .addPrice(oethOracle.address);

    await expect(tx)
      .to.emit(oethOracleUpdater, "AddPrice")
      .withArgs(expectPrice, expectedVaultPrice, marketPrice);

    const roundData = await oethOracle.latestRoundData();
    expect(roundData.answer).to.eq(expectPrice);
  };

  describe("Should add price when", () => {
    describe("vault > 0.995", () => {
      const vaultPrice = parseUnits("0.9956");
      it("curve > 1", async () => {
        const marketPrice = parseUnits("1.001");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: parseUnits("1"),
          expectedVaultPrice: maxVaultPrice,
        });
      });
      it("curve < 1", async () => {
        const marketPrice = parseUnits("0.998");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: marketPrice,
          expectedVaultPrice: maxVaultPrice,
        });
      });
      it("curve < 0.995", async () => {
        const marketPrice = parseUnits("0.992");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: vaultPrice,
          expectedVaultPrice: vaultPrice,
        });
      });
    });
    describe("vault < 0.995", () => {
      const vaultPrice = parseUnits("0.9937");
      it("curve > 1", async () => {
        const marketPrice = parseUnits("1.001");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: parseUnits("1"),
          expectedVaultPrice: maxVaultPrice,
        });
      });
      it("curve > 0.995", async () => {
        const marketPrice = parseUnits("0.9998");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: marketPrice,
          expectedVaultPrice: maxVaultPrice,
        });
      });
      it("curve < 0.995 and curve > vault", async () => {
        const marketPrice = parseUnits("0.9949");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: marketPrice,
          expectedVaultPrice: vaultPrice,
        });
      });
      it("curve < 0.995 and curve < vault", async () => {
        const marketPrice = parseUnits("0.983");

        await assetAddPrice({
          marketPrice,
          vaultPrice,
          expectPrice: vaultPrice,
          expectedVaultPrice: vaultPrice,
        });
      });
    });
  });
  it("Should not add zero price", async () => {
    const { oethOracle, oethOracleUpdater } = fixture;

    const updaterSigner = await impersonateAndFund(oethOracleUpdater.address);
    await expect(oethOracle.connect(updaterSigner).addPrice(0)).to.revertedWith(
      "NoPriceData"
    );
  });
  it("Should not add price by non-updater", async () => {
    const { anna, oethOracle } = fixture;

    await expect(oethOracle.connect(anna).addPrice(0)).to.revertedWith(
      "OnlyOracleUpdater"
    );
  });
  describe("when multiple txs in a block", () => {
    beforeEach(async () => {
      await ethers.provider.send("evm_setAutomine", [false]);
    });
    afterEach(async () => {
      await ethers.provider.send("evm_setAutomine", [true]);
    });
    it("Should not add a second price in the same block", async () => {
      const { oethOracle, oethOracleUpdater } = fixture;

      const updaterSigner = await impersonateAndFund(oethOracleUpdater.address);
      // Add a price so there is at leave 1 round before two are added
      await oethOracle.connect(updaterSigner).addPrice(parseUnits("0.999"));

      // Mine a block
      await ethers.provider.send("evm_mine", []);

      // First add price in block
      await oethOracle.connect(updaterSigner).addPrice(parseUnits("0.998"));
      // Second add price in block
      const tx2 = await oethOracle
        .connect(updaterSigner)
        .addPrice(parseUnits("0.997"));

      // Mine the two transactions in a new block
      await ethers.provider.send("evm_mine", []);

      // ideally this would be revertedWith "AddPriceSameBlock" but it's catching it
      await expect(tx2).to.reverted;
    });
  });
});
