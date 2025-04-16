const { expect } = require("chai");

const { loadDefaultFixture } = require("./../_fixture");
const { isCI } = require("./../helpers");

describe("ForkTest: wOUSD", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should have correct name, symbol and adjuster", async () => {
    const { wousd } = fixture;

    expect(await wousd.name()).to.equal("Wrapped OUSD");
    expect(await wousd.symbol()).to.equal("WOUSD");
    expect(await wousd.adjuster()).to.be.gt(0);
  });
});
