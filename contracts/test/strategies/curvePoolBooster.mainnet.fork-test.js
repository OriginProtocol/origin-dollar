const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");
const { impersonateAndFund } = require("../../utils/signers.js");

const addresses = require("../../utils/addresses");
const { isCI } = require("../helpers");

const { loadDefaultFixture } = require("../_fixture");

describe("ForkTest: CurvePoolBooster", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should have correct params", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    expect(await curvePoolBooster.gauge()).to.equal(
      addresses.mainnet.CurveOUSDUSDTGauge
    );
    expect(await curvePoolBooster.campaignRemoteManager()).to.equal(
      addresses.mainnet.CampaignRemoteManager
    );
    expect(await curvePoolBooster.rewardToken()).to.equal(
      addresses.mainnet.OUSDProxy
    );
    expect(await curvePoolBooster.targetChainId()).to.equal(42161);
    expect(await curvePoolBooster.strategistAddr()).to.equal(strategistAddr);
    expect(await curvePoolBooster.governor()).to.equal(
      addresses.mainnet.Timelock
    );
  });

  it("Should Create a campaign", async () => {
    const { curvePoolBooster, ousd, wousd } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const woethSigner = await impersonateAndFund(wousd.address);
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    // Deal OETH and ETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );

    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("0")
    );
  });

  it("Should Create a campaign with fee", async () => {
    const { curvePoolBooster, ousd, wousd, josh } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const woethSigner = await impersonateAndFund(wousd.address);
    const sStrategist = await ethers.provider.getSigner(strategistAddr);
    const gov = await curvePoolBooster.governor();
    const sGov = await ethers.provider.getSigner(gov);

    // Deal OETH and ETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    // Set fee and fee collector
    await curvePoolBooster.connect(sGov).setFee(1000); // 10%
    await curvePoolBooster.connect(sGov).setFeeCollector(josh.address);
    expect(await ousd.balanceOf(josh.address)).to.equal(0);

    // Create campaign
    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        100
      );

    // Ensure fee is collected
    expect(await ousd.balanceOf(josh.address)).to.equal(parseUnits("1"));
  });

  it("Should set campaign id", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);
    expect(await curvePoolBooster.campaignId()).to.equal(0);

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);
    expect(await curvePoolBooster.campaignId()).to.equal(12);
  });

  it("Should set fee and fee collector", async () => {
    const { curvePoolBooster, josh } = fixture;
    const gov = await curvePoolBooster.governor();
    const sGov = await ethers.provider.getSigner(gov);
    expect(await curvePoolBooster.fee()).to.equal(0);

    await curvePoolBooster.connect(sGov).setFee(100);
    expect(await curvePoolBooster.fee()).to.equal(100);

    expect(await curvePoolBooster.feeCollector()).not.to.equal(josh.address);
    await curvePoolBooster.connect(sGov).setFeeCollector(josh.address);
    expect(await curvePoolBooster.feeCollector()).to.equal(josh.address);
  });

  it("Should manage total rewards", async () => {
    const { curvePoolBooster, ousd, wousd } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const woethSigner = await impersonateAndFund(wousd.address);
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    // Deal OETH and ETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );

    // Deal new OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("13"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await curvePoolBooster
      .connect(sStrategist)
      .manageTotalRewardAmount(parseUnits("0.1"), 0);
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("0")
    );
  });

  it("Should manage number of periods", async () => {
    const { curvePoolBooster, ousd, wousd } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const woethSigner = await impersonateAndFund(wousd.address);
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    // Deal OETH and ETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );

    // Deal new OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("13"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await curvePoolBooster
      .connect(sStrategist)
      .manageNumberOfPeriods(2, parseUnits("0.1"), 0);
  });

  it("Should manage reward per voter", async () => {
    const { curvePoolBooster, ousd, wousd } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const woethSigner = await impersonateAndFund(wousd.address);
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    // Deal OETH and ETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );

    // Deal new OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("13"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await curvePoolBooster
      .connect(sStrategist)
      .manageRewardPerVote(100, parseUnits("0.1"), 0);
  });

  it("Should revert if not called by operator", async () => {
    const { curvePoolBooster } = fixture;
    await expect(
      curvePoolBooster.createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(
      curvePoolBooster.manageTotalRewardAmount(parseUnits("0.1"), 0)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(
      curvePoolBooster.manageNumberOfPeriods(2, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(
      curvePoolBooster.manageRewardPerVote(100, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(curvePoolBooster.setCampaignId(12)).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Should revert if campaign is already created", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);
    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .createCampaign(
          4,
          10,
          [addresses.mainnet.ConvexVoter],
          parseUnits("0.1"),
          0
        )
    ).to.be.revertedWith("Campaign already created");
  });

  it("Should revert if campaign is not created", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageTotalRewardAmount(parseUnits("0.1"), 0)
    ).to.be.revertedWith("Campaign not created");
    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageNumberOfPeriods(2, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Campaign not created");
    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageRewardPerVote(100, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Campaign not created");
  });

  it("Should revert if Invalid number of periods", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageNumberOfPeriods(0, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Invalid number of periods");
  });

  it("Should revert if Invalid reward per vote", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageRewardPerVote(0, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Invalid reward per vote");
  });

  it("Should revert if No reward to manage", async () => {
    const { curvePoolBooster } = fixture;
    const { strategistAddr } = await getNamedAccounts();
    const sStrategist = await ethers.provider.getSigner(strategistAddr);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .createCampaign(
          4,
          10,
          [addresses.mainnet.ConvexVoter],
          parseUnits("0.1"),
          0
        )
    ).to.be.revertedWith("No reward to manage");

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster.connect(sStrategist).manageTotalRewardAmount(0, 0)
    ).to.be.revertedWith("No reward to manage");
  });

  it("Should revert if fee too high", async () => {
    const { curvePoolBooster } = fixture;
    const gov = await curvePoolBooster.governor();
    const sGov = await ethers.provider.getSigner(gov);

    await expect(
      curvePoolBooster.connect(sGov).setFee(10000)
    ).to.be.revertedWith("Fee too high");
  });
});
