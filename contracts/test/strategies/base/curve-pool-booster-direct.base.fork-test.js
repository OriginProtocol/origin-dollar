const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve Pool Booster L2", function () {
  let fixture,
    curvePoolBoosterL2,
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
    curvePoolBoosterL2 = fixture.curvePoolBoosterL2;
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

  describe.only("Classic behavior", () => {
    it("Should have correct parameters after deployment", async () => {
      expect(await curvePoolBoosterL2.rewardToken()).to.be.equal(
        oethb.address
      );
      expect(await curvePoolBoosterL2.gauge()).to.be.equal(
        addresses.base.OETHb_WETH.gauge
      );
      expect(await curvePoolBoosterL2.votemarket()).to.be.equal(
        votemarket.address
      );
      expect(await curvePoolBoosterL2.strategistAddr()).to.be.equal(
        addresses.base.multichainStrategist
      );
      expect(await curvePoolBoosterL2.fee()).to.be.equal(0);
      expect(await curvePoolBoosterL2.feeCollector()).to.be.equal(
        addresses.base.multichainStrategist
      );
    });
    it("Should create a campaign without fee", async () => {
      expect(await curvePoolBoosterL2.campaignId()).to.be.equal(0);
      const campaignCount = await votemarket.campaignCount();

      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));

      const campaignData = await votemarket.campaignById(campaignCount);

      expect(campaignData.chainId).to.be.equal(8453);
      expect(campaignData.gauge).to.be.equal(addresses.base.OETHb_WETH.gauge);
      expect(campaignData.manager).to.be.equal(curvePoolBoosterL2.address);
      expect(campaignData.rewardToken).to.be.equal(oethb.address);
      expect(campaignData.numberOfPeriods).to.be.equal(2);
      expect(campaignData.maxRewardPerVote).to.be.equal(oethUnits("0.2"));
      expect(campaignData.totalRewardAmount).to.be.equal(oethUnits("100"));
      expect(campaignData.hook).to.be.equal(addresses.zero);
      expect(await curvePoolBoosterL2.campaignId()).to.not.be.equal(
        campaignCount + 1
      );
    });
    it("Should create a campaign with fee", async () => {
      await curvePoolBoosterL2.connect(timelockImpersonated).setFee(1000); // 10%

      expect(await curvePoolBoosterL2.campaignId()).to.be.equal(0);
      const campaignCount = await votemarket.campaignCount();

      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));

      const campaignData = await votemarket.campaignById(campaignCount);

      expect(campaignData.chainId).to.be.equal(8453);
      expect(campaignData.gauge).to.be.equal(addresses.base.OETHb_WETH.gauge);
      expect(campaignData.manager).to.be.equal(curvePoolBoosterL2.address);
      expect(campaignData.rewardToken).to.be.equal(oethb.address);
      expect(campaignData.numberOfPeriods).to.be.equal(2);
      expect(campaignData.maxRewardPerVote).to.be.equal(oethUnits("0.2"));
      expect(campaignData.totalRewardAmount).to.be.equal(oethUnits("90"));
      expect(campaignData.hook).to.be.equal(addresses.zero);
      expect(await curvePoolBoosterL2.campaignId()).to.not.be.equal(
        campaignCount + 1
      );
    });
    it("Should manage campaigns: increase number of week", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      const campaignId = await curvePoolBoosterL2.campaignId();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraPeriods = 7;

      await curvePoolBoosterL2
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
      const campaignId = await curvePoolBoosterL2.campaignId();
      const newRewardPerVote = oethUnits("0.4");

      await curvePoolBoosterL2
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
      const campaignId = await curvePoolBoosterL2.campaignId();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraPeriods = 7;
      const newRewardPerVote = oethUnits("0.4");

      await curvePoolBoosterL2
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
      const campaignId = await curvePoolBoosterL2.campaignId();
      const campaignDataBefore = await votemarket.campaignById(campaignId);
      const extraReward = oethUnits("200");

      await giveOETHb(extraReward);
      await curvePoolBoosterL2
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
      expect(await oethb.balanceOf(curvePoolBoosterL2.address)).to.be.equal(
        oethUnits("100")
      );
      await curvePoolBoosterL2
        .connect(timelockImpersonated)
        .rescueToken(oethb.address, strategist.address);
      expect(await oethb.balanceOf(curvePoolBoosterL2.address)).to.be.equal(
        0
      );
    });
    it("Should set fee", async () => {
      expect(await curvePoolBoosterL2.fee()).to.be.equal(0);
      await curvePoolBoosterL2.connect(timelockImpersonated).setFee(1000); // 10%
      expect(await curvePoolBoosterL2.fee()).to.be.equal(1000);
    });
    it("Should set fee collector", async () => {
      expect(await curvePoolBoosterL2.feeCollector()).to.be.equal(
        addresses.base.multichainStrategist
      );
      await curvePoolBoosterL2
        .connect(timelockImpersonated)
        .setFeeCollector(timelock.address);
      expect(await curvePoolBoosterL2.feeCollector()).to.be.equal(
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
        curvePoolBoosterL2.createCampaign(2, oethUnits("0.2"), [])
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });
    it("Manage campaign because: No campaign created", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      await curvePoolBoosterL2
        .connect(strategist)
        .manageCampaign(0, 0, false);
    });
    it("Manage campaign because: No reward to manage", async () => {
      await createCampaign(oethUnits("100"), 2, oethUnits("0.2"));
      await expect(
        curvePoolBoosterL2.connect(strategist).manageCampaign(0, 0, true)
      ).to.be.revertedWith("No reward to manage");
    });
    it("Manage campaign because: Caller is not the Strategist or Governor", async () => {
      await expect(
        curvePoolBoosterL2.manageCampaign(0, 0, false)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });
    it("Rescue token because: Invalid receiver", async () => {
      await expect(
        curvePoolBoosterL2
          .connect(timelockImpersonated)
          .rescueToken(oethb.address, addresses.zero)
      ).to.be.revertedWith("Invalid receiver");
    });
    it("Rescue token because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterL2
          .connect(strategist)
          .rescueToken(oethb.address, strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterL2.connect(strategist).setFee(1000)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee because: Fee too high", async () => {
      await expect(
        curvePoolBoosterL2.connect(timelockImpersonated).setFee(5001)
      ).to.be.revertedWith("Fee too high");
    });
    it("Set fee collector because: Caller is not the Governor", async () => {
      await expect(
        curvePoolBoosterL2
          .connect(strategist)
          .setFeeCollector(timelock.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
    it("Set fee collector because: Invalid fee collector", async () => {
      await expect(
        curvePoolBoosterL2
          .connect(timelockImpersonated)
          .setFeeCollector(addresses.zero)
      ).to.be.revertedWith("Invalid fee collector");
    });
  });

  const giveOETHb = async (amount) => {
    await oethb
      .connect(woethImpersonated)
      .transfer(curvePoolBoosterL2.address, amount);
  };

  const createCampaign = async (amount, duration, rewardPerVote) => {
    await giveOETHb(amount);
    await curvePoolBoosterL2
      .connect(strategist)
      .createCampaign(duration, rewardPerVote, []);
  };
});
