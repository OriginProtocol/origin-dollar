const { expect } = require("chai");
const { parseUnits, formatUnits } = require("ethers/lib/utils");

const { loadDefaultFixture } = require("../_fixture");
const { isCI } = require("../helpers");

const log = require("../../utils/logger")("test:fork:oracles");

describe("ForkTest: Oracles Routers", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("OETH Oracle Router", () => {
    let oethOracleRouter;
    beforeEach(async () => {
      oethOracleRouter = await ethers.getContract("OETHOracleRouter");
    });
    it("should get rETH price", async () => {
      const { reth } = fixture;

      const price = await oethOracleRouter.price(reth.address);
      expect(price).to.gte(parseUnits("1083", 15));
      expect(price).to.lt(parseUnits("109", 16));
    });
    it("should get frxETH price", async () => {
      const { frxETH } = fixture;

      const price = await oethOracleRouter.price(frxETH.address);
      expect(price).to.lt(parseUnits("1", 18));
    });
    it("should get WETH price", async () => {
      const { weth } = fixture;

      const price = await oethOracleRouter.price(weth.address);
      expect(price).to.eq(parseUnits("1", 18));
    });
    it("should get stETH price", async () => {
      const { stETH } = fixture;

      const price = await oethOracleRouter.price(stETH.address);
      expect(price).to.approxEqualTolerance(parseUnits("1", 18), 1);
    });
    it("should get gas costs of assets", async () => {
      const { reth, frxETH, stETH, weth, josh } = fixture;

      for (const asset of [frxETH, reth, stETH, weth]) {
        const tx = await oethOracleRouter
          .connect(josh)
          .populateTransaction.price(asset.address);
        await josh.sendTransaction(tx);
      }
    });
  });
  describe("OETH Oracle", () => {
    it("Should add new OETH Oracle price", async () => {
      const { oethOracle, oethOracleUpdater } = fixture;

      const tx = await oethOracleUpdater.addPrice(oethOracle.address);

      await expect(tx).to.emit(oethOracleUpdater, "AddPrice");

      const data = await oethOracle.latestRoundData();
      log(`OETH price: ${formatUnits(data.answer, 18)}`);

      expect(data.answer).to.be.gte(parseUnits("0.99"));
      expect(data.answer).to.be.lte(parseUnits("1.01"));
      expect(data.roundId).to.be.eq(0);
    });
    it("Should get gas usage of latestRoundData", async () => {
      const { josh, oethOracle, oethOracleUpdater } = fixture;

      await oethOracleUpdater.addPrice(oethOracle.address);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx2 = await oethOracle
        .connect(josh)
        .populateTransaction.latestRoundData();
      await josh.sendTransaction(tx2);
    });
    it("Should add OETH Oracle price twice", async () => {
      const { oethOracle, oethOracleUpdater } = fixture;

      await oethOracleUpdater.addPrice(oethOracle.address);
      await oethOracleUpdater.addPrice(oethOracle.address);

      const data = await oethOracle.latestRoundData();
      log(`Oracle price: ${formatUnits(data.answer, 18)}`);
      log(`Oracle round: ${data.roundId}`);
      log(`Oracle answeredInRound: ${data.answeredInRound}`);
      expect(data.roundId).to.be.eq(1);
    });
  });
});
