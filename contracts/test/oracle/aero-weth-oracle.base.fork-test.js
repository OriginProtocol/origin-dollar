const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { isCI } = require("../helpers");
const addresses = require("../../utils/addresses");

describe("ForkTest: Aero WETH Oracle", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let aeroWethFeed,oracleRouter;
  beforeEach(async () => {
    const AeroWethFeed = await ethers.getContractFactory("PriceFeedPair");
    aeroWethFeed = await AeroWethFeed.deploy(
      addresses.base.aeroUsdPriceFeed,
      addresses.base.ethUsdPriceFeed,
      false,
      true
    );
    await aeroWethFeed.deployed();

    const OracleRouter = await ethers.getContractFactory("BaseOETHOracleRouter");
    oracleRouter = await OracleRouter.deploy(aeroWethFeed.address);
    await oracleRouter.deployed();
    await oracleRouter.cacheDecimals(addresses.base.aeroTokenAddress);
  });

  it("should get WETH price", async () => {
    const price = await oracleRouter.price(addresses.base.wethTokenAddress);
    expect(price).to.eq(parseUnits("1", 18));
  });

  it("should get AERO price", async () => {
    const price = await oracleRouter.price(addresses.base.aeroTokenAddress);
    const poolInstance = await ethers.getContractAt(
      "IPool",
      addresses.base.wethAeroPoolAddress
    );
    const ammPrice = await poolInstance.getAmountOut(
      parseUnits("1"),
      addresses.base.aeroTokenAddress
    );
    expect(price).to.approxEqualTolerance(ammPrice, 1);
  });
});
