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
});
