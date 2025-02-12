const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe.only("ForkTest: Pool Booster", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
  });

  it("Should have the correct initial state", async () => {
    const { oethb } = fixture;
    
  });
});
