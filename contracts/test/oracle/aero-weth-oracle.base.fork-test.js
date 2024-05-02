const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { isCI } = require("../helpers");
const addresses = require("../../utils/addresses");

describe("ForkTest: Aero WETH Oracle", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let aeroWethOracle;

  beforeEach(async () => {
    const AeroWethOracle = await ethers.getContractFactory("AeroWEthPriceFeed");
    aeroWethOracle = await AeroWethOracle.deploy(
      addresses.base.ethUsdPriceFeed,
      addresses.base.aeroUsdPriceFeed
    );
    await aeroWethOracle.deployed();
  });

  it("should get WETH price", async () => {
    const price = await aeroWethOracle.price(addresses.base.wethTokenAddress);
    expect(price).to.eq(parseUnits("1", 18));
  });

  it("should get AERO price", async () => {
    const price = await aeroWethOracle.price(addresses.base.aeroTokenAddress);
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
