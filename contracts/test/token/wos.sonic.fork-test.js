const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Wrapped Origin Sonic Token", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
  });

  it("Should have right config", async () => {
    const { wOSonic } = fixture;

    expect(await wOSonic.decimals()).to.equal(18);
    expect(await wOSonic.symbol()).to.equal("wOS");
    expect(await wOSonic.name()).to.equal("Wrapped OS");
    expect(await wOSonic.adjuster()).to.be.gt(0);
  });
});
