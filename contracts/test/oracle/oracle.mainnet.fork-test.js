const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { loadDefaultFixture } = require("../_fixture");
const { isCI } = require("../helpers");

describe("ForkTest: OETH Oracle Routers", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture, oethOracleRouter;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
    oethOracleRouter = await ethers.getContract("OETHOracleRouter");
  });

  it("should get WETH price", async () => {
    const { weth } = fixture;

    const price = await oethOracleRouter.price(weth.address);
    expect(price).to.eq(parseUnits("1", 18));
  });

  it("should get gas costs of weth", async () => {
    const { weth, josh } = fixture;

    const tx = await oethOracleRouter
      .connect(josh)
      .populateTransaction.price(weth.address);
    await josh.sendTransaction(tx);
  });
});
