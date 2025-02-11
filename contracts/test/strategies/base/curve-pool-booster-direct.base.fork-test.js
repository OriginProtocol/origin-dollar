const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve Pool Booster Direct", function () {
  let fixture,
    curvePoolBoosterDirect,
    votemarket,
    oethb,
    strategist,
    wOETHb,
    epoch,
    epochLength,
    timelock;
  let woethImpersonated, timelockImpersonated;

  beforeEach(async () => {
    fixture = await baseFixture();
    curvePoolBoosterDirect = fixture.curvePoolBoosterDirect;
    votemarket = fixture.votemarket;
    oethb = fixture.oethb;
    strategist = fixture.strategist;
    wOETHb = fixture.wOETHb;
    timelock = fixture.timelock;

    woethImpersonated = await impersonateAndFund(wOETHb.address);
    timelockImpersonated = await impersonateAndFund(timelock.address);
    epoch = await votemarket.currentEpoch();
    epochLength = await votemarket.EPOCH_LENGTH();
  });

  describe("Classic behavior", () => {
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
    it("Should create a campaign without fee", async () => {
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
    it("Should create a campaign with fee", async () => {
      await curvePoolBoosterDirect.connect(timelockImpersonated).setFee(1000); // 10%

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
      expect(campaignData.totalRewardAmount).to.be.equal(oethUnits("90"));
      expect(campaignData.hook).to.be.equal(addresses.zero);
      expect(await curvePoolBoosterDirect.campaignId()).to.not.be.equal(
        campaignCount + 1
      );
    });
    it("Should manage campaigns: increase number of week", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterDirect.campaignId();
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
    it("Should rescue token", async () => {
      await giveOETHb(oethUnits("100"));
      expect(await oethb.balanceOf(curvePoolBoosterDirect.address)).to.be.equal(
        oethUnits("100")
      );
      await curvePoolBoosterDirect
        .connect(timelockImpersonated)
        .rescueToken(oethb.address, strategist.address);
      expect(await oethb.balanceOf(curvePoolBoosterDirect.address)).to.be.equal(
        0
      );
    });
    it("Should set fee", async () => {
      expect(await curvePoolBoosterDirect.fee()).to.be.equal(0);
      await curvePoolBoosterDirect.connect(timelockImpersonated).setFee(1000); // 10%
      expect(await curvePoolBoosterDirect.fee()).to.be.equal(1000);
    });
    it("Should set fee collector", async () => {
      expect(await curvePoolBoosterDirect.feeCollector()).to.be.equal(
        addresses.base.multichainStrategist
      );
      await curvePoolBoosterDirect
        .connect(timelockImpersonated)
        .setFeeCollector(timelock.address);
      expect(await curvePoolBoosterDirect.feeCollector()).to.be.equal(
        timelock.address
      );
    });
  });
  describe("Should revert when", () => {
    it("Create campaign because: Campaign already created", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      await expect(
        createCampaign(oethUnits("100"), 2, oethUnits("0.2"))
      ).to.be.revertedWith("Campaign already created");
    });
    it("Create campaign because: Invalid number of periods", async () => {
      await expect(
        createCampaign(oethUnits("100"), 0, oethUnits("0.2"))
      ).to.be.revertedWith("Invalid number of periods");
    });
    it("Create campaign because: Invalid reward per vote", async () => {
      await expect(createCampaign(oethUnits("100"), 2, 0)).to.be.revertedWith(
        "Invalid reward per vote"
      );
    });
    it("Create campaign because: No reward to manage", async () => {
      await expect(createCampaign(0, 2, oethUnits("0.2"))).to.be.revertedWith(
        "No reward to manage"
      );
    });
    it("Create campaign because: Caller is not the Strategist or Governor", async () => {
      await expect(
        curvePoolBoosterDirect.createCampaign(2, oethUnits("0.2"), [])
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });
    it("Manage campaign because: No campaign created", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      await curvePoolBoosterDirect
        .connect(strategist)
        .manageCampaign(0, 0, false);
    });
    it("Manage campaign because: No reward to manage", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      await expect(
        curvePoolBoosterDirect.connect(strategist).manageCampaign(0, 0, true)
      ).to.be.revertedWith("No reward to manage");
    });
    it("Manage campaign because: Caller is not the Strategist or Governor", async () => {
      await expect(
        curvePoolBoosterDirect.manageCampaign(0, 0, false)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });
    it("Rescue token because: Invalid receiver", async () => {
      await expect(
        curvePoolBoosterDirect
          .connect(timelockImpersonated)
          .rescueToken(oethb.address, addresses.zero)
      ).to.be.revertedWith("Invalid receiver");
    });
    it("Rescue token because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterDirect
          .connect(strategist)
          .rescueToken(oethb.address, strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterDirect.connect(strategist).setFee(1000)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee because: Fee too high", async () => {
      await expect(
        curvePoolBoosterDirect.connect(timelockImpersonated).setFee(5001)
      ).to.be.revertedWith("Fee too high");
    });
    it("Set fee collector because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterDirect
          .connect(strategist)
          .setFeeCollector(timelock.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee collector because: Invalid fee collector", async () => {
      await expect(
        curvePoolBoosterDirect
          .connect(timelockImpersonated)
          .setFeeCollector(addresses.zero)
      ).to.be.revertedWith("Invalid fee collector");
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
