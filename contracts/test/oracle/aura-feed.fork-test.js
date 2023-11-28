const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { hotDeployOption } = require("../_hot-deploy");

describe("ForkTest: Aura/WETH Price Feed", function () {
  this.timeout(0);

  let fixture;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    hotDeployOption(fixture, null, {
      isOethFixture: true,
    });

    fixture.auraWETHPriceFeed = await ethers.getContract("AuraWETHPriceFeed");

    fixture.auraWETHWeightedPool = await ethers.getContractAt(
      "IOracleWeightedPool",
      addresses.mainnet.AuraWeightedOraclePool
    );
  });

  it("should get Aura price", async () => {
    const { auraWETHPriceFeed, auraWETHWeightedPool } = fixture;

    const [price_1h, price_5m] =
      await auraWETHWeightedPool.getTimeWeightedAverage([
        [0, 3600, 300],
        [0, 300, 0],
      ]);

    let shouldRevert = false;
    let diff = oethUnits("0");

    if (price_1h > price_5m) {
      diff = oethUnits("1") - (oethUnits("1") * price_1h) / price_5m;
    } else if (price_5m > price_1h) {
      diff = oethUnits("1") - (oethUnits("1") * price_5m) / price_1h;
    }

    shouldRevert = diff > oethUnits("0.02");

    if (shouldRevert) {
      await expect(auraWETHPriceFeed.price).to.be.revertedWith(
        "HighPriceVolatility"
      );
    } else {
      expect(await auraWETHPriceFeed.price()).to.equal(price_5m);

      const [, answer] = await auraWETHPriceFeed.latestRoundData();
      expect(answer).to.equal(price_5m);
    }

    await expect(auraWETHPriceFeed.getRoundData(1)).to.be.revertedWith(
      "No data present"
    );
  });

  it("should get price from oracle", async () => {
    const { oethOracleRouter, aura } = fixture;
    await oethOracleRouter.price(aura.address);
  });
});
