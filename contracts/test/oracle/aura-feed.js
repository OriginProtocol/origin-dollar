const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");
const { oethUnits } = require("../helpers");

describe("ForkTest: Aura/WETH Price Feed", function () {
  this.timeout(0);

  let fixture;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    fixture.auraWETHPriceFeed = await ethers.getContract("AuraWETHPriceFeed");
    fixture.auraWETHWeightedPool = await ethers.getContract(
      "MockOracleWeightedPool"
    );

    await fixture.auraWETHPriceFeed
      .connect(fixture.governor)
      .setStrategistAddr(fixture.strategist.address);
  });

  it("should get Aura price from weighted pool", async () => {
    const { auraWETHPriceFeed, auraWETHWeightedPool, strategist } = fixture;

    // Price with less than 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1"), oethUnits("1.01")]);

    expect(await auraWETHPriceFeed.price()).to.eq(oethUnits("1.01"));

    // Price with less than 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1.01"), oethUnits("1")]);

    expect(await auraWETHPriceFeed.price()).to.eq(oethUnits("1"));
  });

  it("should revert if price volatility is high", async () => {
    const { auraWETHPriceFeed, auraWETHWeightedPool, strategist } = fixture;

    // Price with > 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1"), oethUnits("1.03")]);

    await expect(auraWETHPriceFeed.price()).to.be.revertedWith(
      "HighPriceVolatility"
    );

    // Price with > 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1.03"), oethUnits("1")]);

    await expect(auraWETHPriceFeed.price()).to.be.revertedWith(
      "HighPriceVolatility"
    );
  });

  it("should revert if paused", async () => {
    const { auraWETHPriceFeed, auraWETHWeightedPool, strategist } = fixture;

    // Price with > 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1"), oethUnits("1")]);

    await auraWETHPriceFeed.connect(strategist).pause();

    await expect(auraWETHPriceFeed.price()).to.be.revertedWith(
      "PriceFeedPausedError"
    );

    // Price with > 2% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1.03"), oethUnits("1")]);

    await expect(auraWETHPriceFeed.price()).to.be.revertedWith(
      "PriceFeedPausedError"
    );
  });

  it("Should allow strategist to pause price feeds", async () => {
    const { auraWETHPriceFeed, strategist } = fixture;

    await expect(await auraWETHPriceFeed.connect(strategist).pause()).to.emit(
      auraWETHPriceFeed,
      "PriceFeedPaused"
    );

    expect(await auraWETHPriceFeed.paused()).to.be.true;
  });

  it("Should allow governor to pause price feeds", async () => {
    const { auraWETHPriceFeed, governor } = fixture;

    await expect(await auraWETHPriceFeed.connect(governor).pause()).to.emit(
      auraWETHPriceFeed,
      "PriceFeedPaused"
    );

    expect(await auraWETHPriceFeed.paused()).to.be.true;
  });

  it("Should allow governor to unpause price feeds", async () => {
    const { auraWETHPriceFeed, governor, strategist } = fixture;

    // Pause it
    await auraWETHPriceFeed.connect(governor).pause();

    await expect(
      auraWETHPriceFeed.connect(strategist).unpause()
    ).to.be.revertedWith("Caller is not the Governor");

    await expect(await auraWETHPriceFeed.connect(governor).unpause()).to.emit(
      auraWETHPriceFeed,
      "PriceFeedUnpaused"
    );
    expect(await auraWETHPriceFeed.paused()).to.be.false;
  });

  it("Should not allow pause/unpause if already in the state", async () => {
    const { auraWETHPriceFeed, governor } = fixture;

    await expect(
      auraWETHPriceFeed.connect(governor).unpause()
    ).to.be.revertedWith("PriceFeedUnpausedError");

    await auraWETHPriceFeed.connect(governor).pause();

    await expect(
      auraWETHPriceFeed.connect(governor).pause()
    ).to.be.revertedWith("PriceFeedPausedError");
  });

  it("Should allow governor to set tolerance value", async () => {
    const { auraWETHWeightedPool, auraWETHPriceFeed, governor, strategist } =
      fixture;

    const tx = await auraWETHPriceFeed
      .connect(governor)
      .setTolerance(oethUnits("0.09"));

    await expect(tx)
      .to.emit(auraWETHPriceFeed, "ToleranceChanged")
      .withArgs(oethUnits("0.02").toString(), oethUnits("0.09").toString());

    expect(await auraWETHPriceFeed.tolerance()).to.eq(oethUnits("0.09"));

    // Price with > 9% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1"), oethUnits("1.1")]);

    await expect(auraWETHPriceFeed.price()).to.be.revertedWith(
      "HighPriceVolatility"
    );

    // Price with < 9% deviation
    await auraWETHWeightedPool
      .connect(strategist)
      .setNextResults([oethUnits("1"), oethUnits("1.05")]);

    await expect(auraWETHPriceFeed.price()).to.not.be.reverted;
  });

  it("Should not allow strategist to set tolerance value", async () => {
    const { auraWETHPriceFeed, strategist } = fixture;

    await expect(
      auraWETHPriceFeed.connect(strategist).setTolerance(oethUnits("0.09"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should not allow higher tolerance", async () => {
    const { auraWETHPriceFeed, governor } = fixture;

    await expect(
      auraWETHPriceFeed.connect(governor).setTolerance(oethUnits("0.11"))
    ).to.be.revertedWith("InvalidToleranceBps");
  });

  it("should get price from oracle", async () => {
    const { oethOracleRouter, aura } = fixture;
    await oethOracleRouter.price(aura.address);
  });

  it("should be compatible with AggregatorV3Interface", async () => {
    const { auraWETHPriceFeed } = fixture;

    const vals = await auraWETHPriceFeed.latestRoundData();

    expect(vals[0]).to.eq("0");
    expect(vals[1]).to.eq(oethUnits("1"));
    expect(vals[2]).to.eq("0");
    expect(vals[3]).to.be.gt("0");
    expect(vals[4]).to.eq("0");

    await expect(auraWETHPriceFeed.getRoundData(1)).to.be.revertedWith(
      "No data present"
    );
  });
});
