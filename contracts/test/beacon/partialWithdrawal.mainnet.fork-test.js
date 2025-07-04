const { expect } = require("chai");
const { createFixtureLoader, beaconChainFixture } = require("../_fixture");
const {
  ousdUnits,
} = require("../helpers");

const loadFixture = createFixtureLoader(beaconChainFixture);

describe("ForkTest: Partial Withdrawal", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should get consolidation fee", async () => {
    const { partialWithdrawal } = fixture;

    const fee = await partialWithdrawal.fee();
    expect(fee).to.be.gt(0);
    expect(fee).to.be.lt(10);
  });

  it("Should request a partial withdrawal", async () => {
    const {
      partialWithdrawal,
      beaconWithdrawalReplaced
     } = fixture;

    const amount = ousdUnits("1");
    // These are two sweeping validators
    const validatorPKey =
      "0xa258246e1217568a751670447879b7af5d6df585c59a15ebf0380f276069eadb11f30dea77cfb7357447dc24517be560";
    await partialWithdrawal.request(validatorPKey, amount);

    expect(await beaconWithdrawalReplaced.lastPublicKey()).to.equal(validatorPKey);
    expect(await beaconWithdrawalReplaced.lastAmount()).to.equal(amount);
  });

});
