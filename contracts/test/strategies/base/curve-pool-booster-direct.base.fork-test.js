const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve AMO strategy", function () {
  let fixture, curvePoolBoosterDirect, votemarket, oethb, strategist, wOETHb;

  let woethImpersonated;

  beforeEach(async () => {
    fixture = await baseFixture();
    curvePoolBoosterDirect = fixture.curvePoolBoosterDirect;
    votemarket = fixture.votemarket;
    oethb = fixture.oethb;
    strategist = fixture.strategist;
    wOETHb = fixture.wOETHb;

    woethImpersonated = await impersonateAndFund(wOETHb.address);
  });

  describe("Initial paramaters", () => {
    it("Should have correct parameters after deployment", async () => {
      expect(await curvePoolBoosterDirect.rewardToken()).to.be.equal(
        oethb.address
      );
      expect(await curvePoolBoosterDirect.gauge()).to.be.equal(
        addresses.base.OETHb_WETH.gauge
      );
      expect(await curvePoolBoosterDirect.votemarket()).to.be.equal(
        votemarket.address
      );
      expect(await curvePoolBoosterDirect.strategistAddr()).to.be.equal(
        addresses.base.multichainStrategist
      );
      expect(await curvePoolBoosterDirect.fee()).to.be.equal(0);
      expect(await curvePoolBoosterDirect.feeCollector()).to.be.equal(
        addresses.base.multichainStrategist
      );
    });
    it("Should create a campaign", async () => {
      expect(await curvePoolBoosterDirect.campaignId()).to.be.equal(0);
      const campaignCount = await votemarket.campaignCount();

      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));

      const campaignData = await votemarket.campaignById(campaignCount);

      expect(campaignData.chainId).to.be.equal(8453);
      expect(campaignData.gauge).to.be.equal(addresses.base.OETHb_WETH.gauge);
      expect(campaignData.manager).to.be.equal(curvePoolBoosterDirect.address);
      expect(campaignData.rewardToken).to.be.equal(oethb.address);
      expect(campaignData.numberOfPeriods).to.be.equal(2);
      expect(campaignData.maxRewardPerVote).to.be.equal(oethUnits("0.2"));
      expect(campaignData.totalRewardAmount).to.be.equal(oethUnits("100"));
      expect(campaignData.hook).to.be.equal(addresses.zero);
      expect(await curvePoolBoosterDirect.campaignId()).to.not.be.equal(
        campaignCount + 1
      );
    });
    it("Should manage campaigns: increase number of week", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterDirect.campaignId();
      const epoch = await votemarket.currentEpoch();
      const epochLength = await votemarket.EPOCH_LENGTH();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraPeriods = 7;

      await curvePoolBoosterDirect
        .connect(strategist)
        .manageCampaign(extraPeriods, 0, false);

      const campaignDataAfter = await votemarket.getCampaignUpgrade(
        campaignId,
        epoch.add(epochLength)
      );
      expect(campaignDataAfter.numberOfPeriods).to.be.equal(
        campaignDataBefore.numberOfPeriods + extraPeriods
      );
    });
    it("Should manage campaigns: increase reward per vote", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterDirect.campaignId();
      const epoch = await votemarket.currentEpoch();
      const epochLength = await votemarket.EPOCH_LENGTH();
      const newRewardPerVote = oethUnits("0.4");

      await curvePoolBoosterDirect
        .connect(strategist)
        .manageCampaign(0, newRewardPerVote, false);

      const campaignDataAfter = await votemarket.getCampaignUpgrade(
        campaignId,
        epoch.add(epochLength)
      );
      expect(campaignDataAfter.maxRewardPerVote).to.be.equal(newRewardPerVote);
    });
    it("Should manage campaigns: increase reward per vote and number of week at same time", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterDirect.campaignId();
      const epoch = await votemarket.currentEpoch();
      const epochLength = await votemarket.EPOCH_LENGTH();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraPeriods = 7;
      const newRewardPerVote = oethUnits("0.4");

      await curvePoolBoosterDirect
        .connect(strategist)
        .manageCampaign(extraPeriods, newRewardPerVote, false);

      const campaignDataAfter = await votemarket.getCampaignUpgrade(
        campaignId,
        epoch.add(epochLength)
      );
      expect(campaignDataAfter.numberOfPeriods).to.be.equal(
        campaignDataBefore.numberOfPeriods + extraPeriods
      );
      expect(campaignDataAfter.maxRewardPerVote).to.be.equal(newRewardPerVote);
    });
    it("Should manage campaigns: increase total reward amount", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterDirect.campaignId();
      const epoch = await votemarket.currentEpoch();
      const epochLength = await votemarket.EPOCH_LENGTH();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraReward = oethUnits("200");

      await giveOETHb(extraReward);
      await curvePoolBoosterDirect
        .connect(strategist)
        .manageCampaign(0, 0, extraReward);

      const campaignDataAfter = await votemarket.getCampaignUpgrade(
        campaignId,
        epoch.add(epochLength)
      );
      expect(campaignDataAfter.totalRewardAmount).to.be.equal(
        campaignDataBefore.totalRewardAmount.add(extraReward)
      );
    });
  });

  const giveOETHb = async (amount) => {
    await oethb
      .connect(woethImpersonated)
      .transfer(curvePoolBoosterDirect.address, amount);
  };

  const createCampaign = async (amount, duration, rewardPerVote) => {
    await giveOETHb(amount);
    await curvePoolBoosterDirect
      .connect(strategist)
      .createCampaign(duration, rewardPerVote, []);
  };
});
