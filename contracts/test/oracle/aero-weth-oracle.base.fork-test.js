const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { isCI } = require("../helpers");
const addresses = require("../../utils/addresses");
const { aeroOETHAMOFixture } = require("../_fixture");

describe("ForkTest: Aero WETH Oracle", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await aeroOETHAMOFixture();
  });

  it("should get WETH price", async () => {
    const { oracleRouter } = fixture;
    const price = await oracleRouter.price(addresses.base.wethTokenAddress);
    expect(price).to.eq(parseUnits("1", 18));
  });

  it("should get AERO price", async () => {
    const { oracleRouter } = fixture;

    const price = await oracleRouter.price(addresses.base.aeroTokenAddress);
    const poolInstance = await ethers.getContractAt(
      "IPool",
      addresses.base.wethAeroPoolAddress
    );
    const ammPrice = await poolInstance.getAmountOut(
      parseUnits("1"),
      addresses.base.aeroTokenAddress
    );
    expect(price).to.approxEqualTolerance(ammPrice, 10); 
  });
});
