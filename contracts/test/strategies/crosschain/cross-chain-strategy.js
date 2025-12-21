// const { expect } = require("chai");

const { isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixtureUnit } = require("../../_fixture");

const loadFixture = createFixtureLoader(crossChainFixtureUnit);

describe.only("ForkTest: CrossChainRemoteStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should initiate a bridge of deposited USDC", async function () {
    const { crossChainRemoteStrategy, messageTransmitter, tokenMessenger } = fixture;

    
  });
});
