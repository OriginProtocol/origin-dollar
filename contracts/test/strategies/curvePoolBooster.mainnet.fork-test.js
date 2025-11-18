const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");
const { impersonateAndFund } = require("../../utils/signers.js");

const addresses = require("../../utils/addresses");
const { isCI } = require("../helpers");

const {
  createFixtureLoader,
  poolBoosterCodeUpdatedFixture,
} = require("../_fixture");
const loadFixture = createFixtureLoader(poolBoosterCodeUpdatedFixture);

describe("ForkTest: CurvePoolBooster", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture,
    curvePoolBooster,
    sStrategist,
    ousd,
    wousd,
    woethSigner,
    josh,
    sGov,
    curvePoolBoosterImpersonated;
  beforeEach(async () => {
    fixture = await loadFixture();
    curvePoolBooster = fixture.curvePoolBooster;
    ousd = fixture.ousd;
    wousd = fixture.wousd;
    josh = fixture.josh;

    // Set Campaign Id to 0
    const { multichainStrategistAddr } = await getNamedAccounts();
    sStrategist = await ethers.provider.getSigner(multichainStrategistAddr);
    const gov = await curvePoolBooster.governor();
    sGov = await ethers.provider.getSigner(gov);
    woethSigner = await impersonateAndFund(wousd.address);
    curvePoolBoosterImpersonated = await impersonateAndFund(
      curvePoolBooster.address
    );

    await curvePoolBooster.connect(sStrategist).setCampaignId(0);
  });

  async function dealOETHAndCreateCampaign() {
    // Empty pool booster for round calculations
    if ((await ousd.balanceOf(curvePoolBooster.address)) > 0) {
      await ousd
        .connect(curvePoolBoosterImpersonated)
        .transfer(
          sStrategist._address,
          await ousd.balanceOf(curvePoolBooster.address)
        );
    }
    // Deal OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("10")
    );

    // Deal ETH to pool booster
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    // Create campaign
    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );
  }

  // --- Initialization ---
  it("Should have correct params", async () => {
    expect(await curvePoolBooster.gauge()).to.equal(
      addresses.mainnet.CurveOUSDUSDTGauge
    );
    expect(await curvePoolBooster.campaignRemoteManager()).to.equal(
      "0x000000009dF57105d76B059178989E01356e4b45"
    );
    expect(await curvePoolBooster.rewardToken()).to.equal(
      addresses.mainnet.OUSDProxy
    );
    expect(await curvePoolBooster.targetChainId()).to.equal(42161);
    expect(await curvePoolBooster.strategistAddr()).to.equal(
      sStrategist._address
    );
    expect(await curvePoolBooster.governor()).to.equal(
      addresses.mainnet.Timelock
    );
    expect(await curvePoolBooster.votemarket()).to.equal(
      "0x5e5C922a5Eeab508486eB906ebE7bDFFB05D81e5"
    );
  });

  // --- Campaign Management ---
  it("Should Create a campaign", async () => {
    await dealOETHAndCreateCampaign();

    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("0")
    );
  });

  it("Should Create a campaign with fee", async () => {
    // Set fee and fee collector
    await curvePoolBooster.connect(sGov).setFee(1000); // 10%
    await curvePoolBooster.connect(sGov).setFeeCollector(josh.address);
    expect(await ousd.balanceOf(josh.address)).to.equal(0);

    // Deal OETH and create campaign
    await dealOETHAndCreateCampaign();

    // Ensure fee is collected
    expect(await ousd.balanceOf(josh.address)).to.gte(parseUnits("1"));
  });

  it("Should manage total rewards", async () => {
    await dealOETHAndCreateCampaign();

    // Deal new OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("13"));
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
    await dealOETHAndCreateCampaign();

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await curvePoolBooster
      .connect(sStrategist)
      .manageNumberOfPeriods(2, parseUnits("0.1"), 0);
  });

  it("Should manage reward per voter", async () => {
    await dealOETHAndCreateCampaign();

    // Deal new OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("13"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(
      parseUnits("13")
    );

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await curvePoolBooster
      .connect(sStrategist)
      .manageRewardPerVote(100, parseUnits("0.1"), 0);
  });

  it("Should close a campaign", async () => {
    await dealOETHAndCreateCampaign();

    await curvePoolBooster
      .connect(sStrategist)
      .closeCampaign(12, parseUnits("0.1"), 0);
  });

  it("Should revert if not called by operator", async () => {
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

  it("Should create another campaign if campaign is closed", async () => {
    await curvePoolBooster.connect(sStrategist).setCampaignId(12);
    await curvePoolBooster
      .connect(sStrategist)
      .closeCampaign(12, parseUnits("0.1"), 0);

    expect(await curvePoolBooster.campaignId()).to.equal(0);

    // Create campaign
    await curvePoolBooster
      .connect(sStrategist)
      .createCampaign(
        4,
        10,
        [addresses.mainnet.ConvexVoter],
        parseUnits("0.1"),
        0
      );
  });

  it("Should revert if campaign is not created", async () => {
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
    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .createCampaign(
          0,
          10,
          [addresses.mainnet.ConvexVoter],
          parseUnits("0.1"),
          0
        )
    ).to.be.revertedWith("Invalid number of periods");

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageNumberOfPeriods(0, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Invalid number of periods");
  });

  it("Should revert if Invalid reward per vote", async () => {
    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .createCampaign(
          4,
          0,
          [addresses.mainnet.ConvexVoter],
          parseUnits("0.1"),
          0
        )
    ).to.be.revertedWith("Invalid reward per vote");

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);

    await expect(
      curvePoolBooster
        .connect(sStrategist)
        .manageRewardPerVote(0, parseUnits("0.1"), 0)
    ).to.be.revertedWith("Invalid reward per vote");
  });

  it("Should revert if No reward to manage", async () => {
    if ((await ousd.balanceOf(curvePoolBooster.address)) > 0) {
      await ousd
        .connect(curvePoolBoosterImpersonated)
        .transfer(
          sStrategist._address,
          await ousd.balanceOf(curvePoolBooster.address)
        );
    }

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

  // --- Rescue ETH and ERC20 ---
  it("Should rescue ETH", async () => {
    // Deal ETH to pool booster
    await sStrategist.sendTransaction({
      to: curvePoolBooster.address,
      value: parseUnits("1"),
    });

    const balanceBefore = await ethers.provider.getBalance(
      curvePoolBooster.address
    );
    await curvePoolBooster.connect(sStrategist).rescueETH(sStrategist._address);
    const balanceAfter = await ethers.provider.getBalance(
      curvePoolBooster.address
    );
    expect(balanceBefore).to.be.gte(parseUnits("1"));
    expect(balanceAfter).to.be.eq(parseUnits("0"));
  });

  it("Should rescue ERC20", async () => {
    // Deal OETH to pool booster
    await ousd
      .connect(woethSigner)
      .transfer(curvePoolBooster.address, parseUnits("10"));
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.be.gte(
      parseUnits("10")
    );

    await curvePoolBooster
      .connect(sGov)
      .rescueToken(ousd.address, sStrategist._address);
    expect(await ousd.balanceOf(curvePoolBooster.address)).to.equal(0);
  });

  it("Should revert if receiver is invalid", async () => {
    await expect(
      curvePoolBooster.connect(sGov).rescueToken(ousd.address, addresses.zero)
    ).to.be.revertedWith("Invalid receiver");

    await expect(
      curvePoolBooster.connect(sGov).rescueETH(addresses.zero)
    ).to.be.revertedWith("Invalid receiver");
  });

  // --- Setters ---
  it("Should set campaign id", async () => {
    expect(await curvePoolBooster.campaignId()).to.equal(0);

    await curvePoolBooster.connect(sStrategist).setCampaignId(12);
    expect(await curvePoolBooster.campaignId()).to.equal(12);
  });

  it("Should set fee and fee collector", async () => {
    expect(await curvePoolBooster.fee()).to.equal(0);

    await curvePoolBooster.connect(sGov).setFee(100);
    expect(await curvePoolBooster.fee()).to.equal(100);

    expect(await curvePoolBooster.feeCollector()).not.to.equal(josh.address);
    await curvePoolBooster.connect(sGov).setFeeCollector(josh.address);
    expect(await curvePoolBooster.feeCollector()).to.equal(josh.address);
  });

  it("Should revert if fee too high", async () => {
    await expect(
      curvePoolBooster.connect(sGov).setFee(10000)
    ).to.be.revertedWith("Fee too high");
  });

  it("Should set Campaign Remote Manager", async () => {
    expect(await curvePoolBooster.campaignRemoteManager()).to.equal(
      "0x000000009dF57105d76B059178989E01356e4b45"
    );

    await curvePoolBooster.connect(sGov).setCampaignRemoteManager(josh.address);

    expect(await curvePoolBooster.campaignRemoteManager()).to.equal(
      josh.address
    );
  });

  it("Should revert if campaign remote manager is invalid", async () => {
    await expect(
      curvePoolBooster.connect(sGov).setCampaignRemoteManager(addresses.zero)
    ).to.be.revertedWith("Invalid campaignRemoteManager");
  });

  it("Should set Votemarket address", async () => {
    expect(await curvePoolBooster.votemarket()).to.equal(
      "0x5e5C922a5Eeab508486eB906ebE7bDFFB05D81e5"
    );

    await curvePoolBooster.connect(sGov).setVotemarket(josh.address);

    expect(await curvePoolBooster.votemarket()).to.equal(josh.address);
  });

  it("Should revert if votemarket is invalid", async () => {
    await expect(
      curvePoolBooster.connect(sGov).setVotemarket(addresses.zero)
    ).to.be.revertedWith("Invalid votemarket");
  });
});
