const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");

describe("ForkTest: Aura/WETH Price Feed", function () {
  this.timeout(0);

  let fixture;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    await deployments.deploy("AuraWETHPriceFeed", {
      from: await fixture.strategist.getAddress(),
      args: [
        addresses.mainnet.auraWETHWeightedPool
      ]
    });

    fixture.auraWETHPriceFeed = await ethers.getContract("AuraWETHPriceFeed")

    fixture.auraWETHWeightedPool = await ethers.getContractAt(
      "IOracleWeightedPool",
      addresses.mainnet.auraWETHWeightedPool
    );
  });

  it("should get Aura price", async () => {
    const { auraWETHPriceFeed, auraWETHWeightedPool } = fixture;

    const [price_1h, price_5m] = await auraWETHWeightedPool.getTimeWeightedAverage([
      [0, 3600, 300],
      [0, 300, 0],
    ])

    let shouldRevert = false;
    let diff = oethUnits("0")

    if (price_1h > price_5m) {
      diff = oethUnits("1") - ((oethUnits("1") * price_1h) / price_5m)
    } else if (price_5m > price_1h) {
      diff = oethUnits("1") - ((oethUnits("1") * price_5m) / price_1h)
    }

    shouldRevert = diff > oethUnits("0.02")

    if (shouldRevert) {
      await expect(auraWETHPriceFeed.price).to.be.revertedWith("High price volatility")
    } else {
      expect(await auraWETHPriceFeed.price()).to.equal(
        price_5m
      )

      const [, answer] = await auraWETHPriceFeed.latestRoundData()
      expect(answer).to.equal(price_5m)
    }

    await expect(auraWETHPriceFeed.getRoundData(1)).to.be.revertedWith("Not implemented")
  });
});
