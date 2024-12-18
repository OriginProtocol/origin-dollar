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
        const { deployerAddr } = await getNamedAccounts();
        expect(await curvePoolBooster.gauge()).to.equal(addresses.mainnet.CurveOETHGauge);
        expect(await curvePoolBooster.campaignRemoteManager()).to.equal(addresses.mainnet.CampaignRemoteManager);
        expect(await curvePoolBooster.rewardToken()).to.equal(addresses.mainnet.OETHProxy);
        expect(await curvePoolBooster.targetChainId()).to.equal(42161);
        expect(await curvePoolBooster.operator()).to.equal(deployerAddr);
        expect(await curvePoolBooster.governor()).to.equal(addresses.mainnet.Timelock);
    })

    it("Should Create a campaign", async () => {
        const { curvePoolBooster, oeth, woeth } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const woethSigner = await impersonateAndFund(woeth.address);
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        // Deal OETH and ETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("10"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("10"));
        await sDeployer.sendTransaction({ to: curvePoolBooster.address, value: parseUnits("1") });

        await curvePoolBooster.connect(sDeployer).createCampaign(4, 10, parseUnits("0.1"), 0);

        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("0"));
    });

    it("Should set campaign id", async () => {
        const { curvePoolBooster } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const sDeployer = await ethers.provider.getSigner(deployerAddr);
        expect(await curvePoolBooster.campaignId()).to.equal(0);

        await curvePoolBooster.connect(sDeployer).setCampaignId(12);
        expect(await curvePoolBooster.campaignId()).to.equal(12);
    });

    it("Should manage total rewards", async () => {
        const { curvePoolBooster, oeth, woeth } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const woethSigner = await impersonateAndFund(woeth.address);
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        // Deal OETH and ETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("10"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("10"));
        await sDeployer.sendTransaction({ to: curvePoolBooster.address, value: parseUnits("1") });

        await curvePoolBooster.connect(sDeployer).createCampaign(4, 10, parseUnits("0.1"), 0);

        // Deal new OETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));

        await curvePoolBooster.connect(sDeployer).setCampaignId(12);

        await curvePoolBooster.connect(sDeployer).manageTotalRewardAmount(parseUnits("0.1"), 0);
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("0"));
    })

    it("Should manage number of periods", async () => {
        const { curvePoolBooster, oeth, woeth } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const woethSigner = await impersonateAndFund(woeth.address);
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        // Deal OETH and ETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("10"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("10"));
        await sDeployer.sendTransaction({ to: curvePoolBooster.address, value: parseUnits("1") });

        await curvePoolBooster.connect(sDeployer).createCampaign(4, 10, parseUnits("0.1"), 0);

        // Deal new OETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));

        await curvePoolBooster.connect(sDeployer).setCampaignId(12);

        await curvePoolBooster.connect(sDeployer).manageNumberOfPeriods(2, parseUnits("0.1"), 0);
    });

    it("Should manage reward per voter", async () => {
        const { curvePoolBooster, oeth, woeth } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const woethSigner = await impersonateAndFund(woeth.address);
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        // Deal OETH and ETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("10"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("10"));
        await sDeployer.sendTransaction({ to: curvePoolBooster.address, value: parseUnits("1") });

        await curvePoolBooster.connect(sDeployer).createCampaign(4, 10, parseUnits("0.1"), 0);

        // Deal new OETH to pool booster
        await oeth.connect(woethSigner).transfer(curvePoolBooster.address, parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));
        expect(await oeth.balanceOf(curvePoolBooster.address)).to.equal(parseUnits("13"));

        await curvePoolBooster.connect(sDeployer).setCampaignId(12);

        await curvePoolBooster.connect(sDeployer).manageRewardPerVote(100, parseUnits("0.1"), 0);
    });

    it("Should revert if not called by operator", async () => {
        const { curvePoolBooster } = fixture;
        const { deployerAddr } = await getNamedAccounts();

        await expect(curvePoolBooster.createCampaign(4, 10, parseUnits("0.1"), 0)).to.be.revertedWith("Only Operator or Governor");
        await expect(curvePoolBooster.manageTotalRewardAmount(parseUnits("0.1"), 0)).to.be.revertedWith("Only Operator or Governor");
        await expect(curvePoolBooster.manageNumberOfPeriods(2, parseUnits("0.1"), 0)).to.be.revertedWith("Only Operator or Governor");
        await expect(curvePoolBooster.manageRewardPerVote(100, parseUnits("0.1"), 0)).to.be.revertedWith("Only Operator or Governor");
        await expect(curvePoolBooster.setCampaignId(12)).to.be.revertedWith("Only Operator or Governor");
        await expect(curvePoolBooster.setOperator(deployerAddr)).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should revert if campaign is already created", async () => {
        const { curvePoolBooster } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const sDeployer = await ethers.provider.getSigner(deployerAddr);
        await curvePoolBooster.connect(sDeployer).setCampaignId(12);

        await expect(curvePoolBooster.connect(sDeployer).createCampaign(4, 10, parseUnits("0.1"), 0)).to.be.revertedWith("Campaign already created");
    });

    it("Should revert if campaign is not created", async () => {
        const { curvePoolBooster } = fixture;
        const { deployerAddr } = await getNamedAccounts();
        const sDeployer = await ethers.provider.getSigner(deployerAddr);

        await expect(curvePoolBooster.connect(sDeployer).manageTotalRewardAmount(parseUnits("0.1"), 0)).to.be.revertedWith("Campaign not created");
        await expect(curvePoolBooster.connect(sDeployer).manageNumberOfPeriods(2, parseUnits("0.1"), 0)).to.be.revertedWith("Campaign not created");
        await expect(curvePoolBooster.connect(sDeployer).manageRewardPerVote(100, parseUnits("0.1"), 0)).to.be.revertedWith("Campaign not created");
    });
});