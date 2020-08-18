const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { oracleUnits } = require("./helpers");

describe("Oracle", async () => {
  it("Should allow multiple prices to be set and read", async () => {
    const { oracle } = await waffle.loadFixture(defaultFixture);
    await oracle.setPrice("DAI", oracleUnits("1.02"));
    await oracle.setPrice("USDT", oracleUnits("0.96"));
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
    expect(await oracle.price("USDT")).to.eq(oracleUnits("0.96"));
  });
});
