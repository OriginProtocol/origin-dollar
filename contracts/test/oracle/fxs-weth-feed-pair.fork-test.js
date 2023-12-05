const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { hotDeployOption } = require("../_hot-deploy");
const aggregatorInterfaceAbi = require("../abi/AggregatorInterfaceAbi.json");
const { BigNumber } = ethers;

describe("ForkTest: FXS/WETH Price Feed Pair", function () {
  this.timeout(0);

  let fixture;
  let fxsUsdFeed;
  let ethUsdFeed;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    hotDeployOption(fixture, null, {
      isOethFixture: true,
    });

    fixture.fxsWethPriceFeedPair = await ethers.getContract(
      "FXS_ETHPriceFeedPair"
    );

    fixture.fxsUsdFeed = await ethers.getContractAt(
      aggregatorInterfaceAbi,
      addresses.mainnet.chainlinkFXS_USD
    );
    fixture.ethUsdFeed = await ethers.getContractAt(
      aggregatorInterfaceAbi,
      addresses.mainnet.chainlinkETH_USD
    );
  });

  it("should correctly report feed price", async () => {
    const { fxsWethPriceFeedPair, fxsUsdFeed, ethUsdFeed } = fixture;
    const decimals18 = BigNumber.from("1000000000000000000");
    const decimals8 = BigNumber.from("100000000");
    const decimals2 = BigNumber.from("100");

    // denominated in 8 decimals
    const fxsUsdPrice = (await fxsUsdFeed.latestRoundData())[1];
    // denominated in 8 decimals
    const ethUsdPrice = (await ethUsdFeed.latestRoundData())[1];
    // denominated in 18 decimals
    const usdEthPrice = decimals18.mul(decimals8).div(ethUsdPrice);
    // 8 decimals * 18 decimals / 8 decimals = 18 decimal denomination
    const expectedFxsEthPrice = fxsUsdPrice.mul(usdEthPrice).div(decimals8);

    // denominated in 18 decimals
    const fxsWethPrice = (await fxsWethPriceFeedPair.latestRoundData())[1];

    expect(expectedFxsEthPrice).to.equal(fxsWethPrice);
  });

  it("should correctly report updatedAt time", async () => {
    const { fxsWethPriceFeedPair, fxsUsdFeed, ethUsdFeed } = fixture;

    const fxsUsdUpdatedAt = (await fxsUsdFeed.latestRoundData())[3];
    const ethUsdUpdatedAt = (await ethUsdFeed.latestRoundData())[3];
    let expectedFxsWethUpdatedAt = fxsUsdUpdatedAt;

    if (fxsUsdUpdatedAt.gt(ethUsdUpdatedAt)) {
      expectedFxsWethUpdatedAt = ethUsdUpdatedAt;
    }

    // denominated in 18 decimals
    const fxsWethUpdatedAt = (await fxsWethPriceFeedPair.latestRoundData())[3];

    expect(expectedFxsWethUpdatedAt).to.equal(fxsWethUpdatedAt);
  });

  it("should revert querying specific round data", async () => {
    const { fxsWethPriceFeedPair } = fixture;
    expect(fxsWethPriceFeedPair.getRoundData(BigNumber.from("1")))
      .to.be.revertedWith("No data present");
  });
});
