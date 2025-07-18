const { expect } = require("chai");
const { createFixtureLoader, beaconChainFixture } = require("../_fixture");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Beacon Consolidation", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should get consolidation fee", async () => {
    const { beaconConsolidation } = fixture;

    const fee = await beaconConsolidation.fee();
    expect(fee).to.be.gt(0);
    expect(fee).to.be.lt(10);
  });

  it("Should request consolidation of validators", async () => {
    const { beaconConsolidation, beaconConsolidationReplaced } = fixture;

    // These are two sweeping validators
    const source =
      "0xa31b5e5d655a06d849a36e5b03f1b9e647f911f38857c2a263973fba90f61b528173fb7a7cddd63dbe7e6604e7d61c87";
    const target =
      "0xa258246e1217568a751670447879b7af5d6df585c59a15ebf0380f276069eadb11f30dea77cfb7357447dc24517be560";
    await beaconConsolidation.request(source, target);

    expect(await beaconConsolidationReplaced.lastSource()).to.equal(source);
    expect(await beaconConsolidationReplaced.lastTarget()).to.equal(target);
  });
});
