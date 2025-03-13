const { createFixtureLoader } = require("../_fixture");
const {
  defaultSonicFixture,
  filterAndParseNotifyRewardEvents,
  getPoolBoosterContractFromPoolAddress,
} = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

const S_WETH_POOL_ADDRESS = "0xb6d9b069f6b96a507243d501d1a23b3fccfc85d3";
const S_WETH_GAUGE_V2_ADDRESS = "0xF5C7598C953E49755576CDA6b2B2A9dAaf89a837";

describe("ForkTest: Shadow Pool Booster (for S/WETH pool)", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
    const { wS, oSonicVault, nick } = fixture;
    // mint some OS
    await oSonicVault
      .connect(nick)
      .mint(wS.address, oethUnits("1000"), oethUnits("0"));
  });

  it("Should create a pool booster for Shadow and bribe", async () => {
    const { poolBoosterSingleFactoryV1, governor, oSonic, nick } = fixture;

    const creationParams = [
      S_WETH_GAUGE_V2_ADDRESS, //_bribeAddress
      S_WETH_POOL_ADDRESS, //_ammPoolAddress
      oethUnits("12345"), //_salt
    ];

    await poolBoosterSingleFactoryV1
      .connect(governor)
      // the addresses below are not suitable for pool boosting. Still they will serve the
      // purpose of confirming correct setup.
      .createPoolBoosterSwapxSingle(...creationParams);

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterSingleFactoryV1,
      S_WETH_POOL_ADDRESS
    );

    const computedAddress =
      await poolBoosterSingleFactoryV1.computePoolBoosterAddress(
        ...creationParams
      );

    expect(poolBooster.address).to.equal(computedAddress);

    await oSonic.connect(nick).transfer(poolBooster.address, oethUnits("10"));
    const bribeBalance = await oSonic.balanceOf(poolBooster.address);
    const tx = await poolBooster.bribe();
    const balanceAfter = await oSonic.balanceOf(poolBooster.address);

    // extract the emitted RewardAdded events
    const notifyRewardEvents = await filterAndParseNotifyRewardEvents(
      tx,
      S_WETH_GAUGE_V2_ADDRESS
    );

    expect(notifyRewardEvents.length).to.equal(1);
    expect(notifyRewardEvents[0].briber).to.equal(poolBooster.address);
    expect(notifyRewardEvents[0].rewardToken).to.equal(oSonic.address);
    expect(notifyRewardEvents[0].amount).to.equal(bribeBalance);

    expect(balanceAfter).to.equal(0);
  });
});
