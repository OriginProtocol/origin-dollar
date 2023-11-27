const { expect } = require("chai");
const { parseUnits, formatUnits } = require("ethers/lib/utils");

const { loadDefaultFixture } = require("../_fixture");
const { isCI } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers.js");
const addresses = require("../../utils/addresses");

const log = require("../../utils/logger")("test:fork:oracles");

describe("ForkTest: Oracles", function () {
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

    it("should have valid Oracle decimals", async () => {
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.WETH)).to
        .be.true;
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.rETH)).to
        .be.true;
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.frxETH))
        .to.be.true;
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.stETH)).to
        .be.true;
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.CRV)).to
        .be.true;
      expect(await oethOracleRouter.isDecimalsValid(addresses.mainnet.CVX)).to
        .be.true;
    });

    it("should get rETH price", async () => {
      const { reth } = fixture;

      const price = await oethOracleRouter.price(reth.address);
      expect(price).to.gte(parseUnits("1083", 15));
      expect(price).to.lt(parseUnits("111", 16));
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
    it.only("should get gas costs of assets", async () => {
      const { weth, josh } = fixture;

      const tx = await oethOracleRouter
        .connect(josh)
        .populateTransaction.price(weth.address);
      await josh.sendTransaction(tx);
    });
  });
  describe("OETH Oracle", () => {
    it("Should be initialized", async () => {
      const { oethOracle, oethOracleUpdater, oethVault } = fixture;

      expect(await oethOracleUpdater.governor()).to.eq(
        addresses.mainnet.Timelock
      );
      expect(await oethOracleUpdater.MAX_VAULT_PRICE()).to.eq(
        parseUnits("0.995")
      );
      expect(await oethOracleUpdater.curvePool()).to.eq(
        addresses.mainnet.CurveOETHMetaPool
      );
      expect(await oethOracleUpdater.vault()).to.eq(oethVault.address);

      expect(await oethOracle.decimals()).to.eq(18);
      expect(await oethOracle.version()).to.eq(1);
      expect(await oethOracle.oracleUpdater()).to.eq(oethOracleUpdater.address);
      expect(await oethOracle.governor()).to.eq(addresses.mainnet.Timelock);
    });
    it("Should get price from OETH Oracle Updater", async () => {
      const { oethOracleUpdater } = fixture;

      const prices = await oethOracleUpdater.getPrices();

      expect(prices.answer).to.be.gte(parseUnits("0.99"));
      expect(prices.answer).to.be.lt(parseUnits("1"));
      expect(prices.vaultPrice).to.be.lte(parseUnits("0.995"));
      expect(prices.marketPrice).to.be.gte(parseUnits("0.99"));
      expect(prices.marketPrice).to.be.lt(parseUnits("1.01"));
    });
    it("Should add new OETH Oracle price", async () => {
      const { oethOracle, oethOracleUpdater } = fixture;

      const tx = await oethOracleUpdater.addPrice(oethOracle.address);

      await expect(tx)
        .to.emit(oethOracleUpdater, "AddPrice")
        .withNamedArgs({ oracle: oethOracle.address });

      const data = await oethOracle.latestRoundData();
      log(`OETH price: ${formatUnits(data.answer, 18)}`);

      expect(data.answer).to.be.gte(parseUnits("0.99"));
      expect(data.answer).to.be.lte(parseUnits("1.0001"));
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
    it("Should not add OETH Oracle price by anyone", async () => {
      const { oethOracle, anna, strategist, governor, harvester, oethVault } =
        fixture;

      const harvesterSigner = await impersonateAndFund(harvester.address);
      const oethVaultSigner = await impersonateAndFund(oethVault.address);

      for (const signer of [
        anna,
        strategist,
        governor,
        harvesterSigner,
        oethVaultSigner,
      ]) {
        await expect(
          oethOracle.connect(signer).addPrice(parseUnits("999", 15))
        ).to.revertedWith("OnlyOracleUpdater");
      }
    });
    it("Should update the oracle updater by the governance timelock", async () => {
      const { oethOracle, anna, timelock } = fixture;

      const tx = await oethOracle
        .connect(timelock)
        .setOracleUpdater(anna.address);

      await expect(tx)
        .to.emit(oethOracle, "SetOracleUpdater")
        .withArgs(anna.address);

      expect(await oethOracle.oracleUpdater()).to.eq(anna.address);
    });
    it("Should not update the oracle updater by the governance timelock", async () => {
      const { oethOracle, anna, strategist, governor, harvester, oethVault } =
        fixture;

      const harvesterSigner = await impersonateAndFund(harvester.address);
      const oethVaultSigner = await impersonateAndFund(oethVault.address);

      for (const signer of [
        anna,
        strategist,
        governor,
        harvesterSigner,
        oethVaultSigner,
      ]) {
        await expect(
          oethOracle.connect(signer).setOracleUpdater(anna.address)
        ).to.revertedWith("Caller is not the Governor");
      }
    });
  });
});
