const { createFixtureLoader, defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");

const sonicFixture = createFixtureLoader(defaultFixture);

describe("ForkTest: Merkl Pool Booster", function () {
  //const INCENTIVISE_BORROWING_TYPE = 45;
  //const DEFAULT_DURATION = 86400 * 7; // a week
  //const MOPRHO_CAMPAIGN_DATA = "0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  let fixture, poolBoosterMerklFactory, merklDistributor, oeth;
  beforeEach(async () => {
    fixture = await sonicFixture();
    oeth = fixture.oeth;
    poolBoosterMerklFactory = fixture.poolBoosterMerklFactory;
    merklDistributor = fixture.merklDistributor;
  });

  it("Should have correct deployment params", async () => {
    expect(await poolBoosterMerklFactory.merklDistributor()).to.equal(
      addresses.mainnet.CampaignCreator
    );

    // Uncomment once the pool booster is deployed
    // const poolBooster = await poolBoosterMerklFactory.poolBoosters(0)
    // expect(await poolBooster.campaignType()).to.equal(
    //   INCENTIVISE_BORROWING_TYPE
    // );

    // expect(await poolBooster.duration()).to.equal(
    //   DEFAULT_DURATION
    // );

    // expect(await poolBooster.campaignData()).to.equal(
    //   MOPRHO_CAMPAIGN_DATA
    // );

    // expect(await poolBooster.rewardToken()).to.equal(oeth.address);
    // expect(await poolBooster.merklDistributor()).to.equal(merklDistributor.address);
  });

  it("Should have OETH token supported by Merkl Distributor", async () => {
    expect(await merklDistributor.rewardTokenMinAmounts(oeth.address)).to.equal(
      oethUnits("0.00001")
    );
  });
});
