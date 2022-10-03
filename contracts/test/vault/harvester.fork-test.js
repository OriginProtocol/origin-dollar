const { expect } = require("chai");

const { defaultFixture } = require("./../_fixture");
const { utils } = require("ethers");

const { loadFixture, forkOnlyDescribe } = require("./../helpers");
const { MAX_UINT256 } = require("../../utils/constants");

forkOnlyDescribe("ForkTest: Harvester", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(defaultFixture);
  });

  describe("Rewards Config", () => {
    it("Should have correct reward token config for CRV", async () => {
      const { harvester, crv } = fixture;

      const config = await harvester.rewardTokenConfigs(crv.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.uniswapV2CompatibleAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(MAX_UINT256);
    });

    it("Should have correct reward token config for CVX", async () => {
      const { harvester, cvx } = fixture;

      const config = await harvester.rewardTokenConfigs(cvx.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.uniswapV2CompatibleAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(utils.parseEther("2500"));
    });

    it("Should have correct reward token config for COMP", async () => {
      const { harvester, comp } = fixture;

      const config = await harvester.rewardTokenConfigs(comp.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.uniswapV2CompatibleAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(MAX_UINT256);
    });

    it("Should have correct reward token config for AAVE", async () => {
      const { harvester, aave } = fixture;

      const config = await harvester.rewardTokenConfigs(aave.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.uniswapV2CompatibleAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(MAX_UINT256);
    });
  });

  describe("Harvest", () => {
    it("Should harvest from all strategies", async () => {
      const { harvester, governor } = fixture;
      await harvester.connect(governor)["harvest()"]();
    });

    it("Should swap all coins", async () => {
      const { harvester, governor } = fixture;
      await harvester.connect(governor).swap();
    });

    it("Should harvest and swap from all strategies", async () => {
      const { harvester, governor } = fixture;
      await harvester.connect(governor)["harvestAndSwap()"]();
    });

    it("Should swap CRV", async () => {
      const { harvester, governor, crv } = fixture;
      await harvester.connect(governor).swapRewardToken(crv.address);
    });

    it("Should swap CVX", async () => {
      const { harvester, governor, cvx } = fixture;
      await harvester.connect(governor).swapRewardToken(cvx.address);
    });

    it("Should swap COMP", async () => {
      const { harvester, governor, comp } = fixture;
      await harvester.connect(governor).swapRewardToken(comp.address);
    });

    it("Should swap AAVE", async () => {
      const { harvester, governor, aave } = fixture;
      await harvester.connect(governor).swapRewardToken(aave.address);
    });

    // TODO: Tests for `harvest(address)` for each strategy
  });
});
