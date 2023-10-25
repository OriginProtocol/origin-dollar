const { expect } = require("chai");
const { utils } = require("ethers").ethers;

const { loadDefaultFixture } = require("./../_fixture");
const { isCI } = require("./../helpers");
const { MAX_UINT256 } = require("../../utils/constants");
const { parseUnits } = require("ethers");

describe("ForkTest: Harvester", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("Rewards Config", () => {
    it("Should have correct reward token config for CRV", async () => {
      const { harvester, crv } = fixture;

      const config = await harvester.rewardTokenConfigs(crv.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.uniswapV2CompatibleAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("4000", 18));
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
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock)["harvest()"]();
    });

    it("Should swap all coins", async () => {
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock).swap();
    });

    it.skip("Should harvest and swap from all strategies", async () => {
      // Skip this test because we don't call or use this method anywhere.
      // Also, because this test is flaky at times due to slippage and the
      // individual `harvest` and `swap` methods for each strategies are
      // covered in the tests above this.
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock)["harvestAndSwap()"]();
    });

    it("Should swap CRV", async () => {
      const { harvester, timelock, crv } = fixture;
      await harvester.connect(timelock).swapRewardToken(crv.address);
    });

    it("Should swap CVX", async () => {
      const { harvester, timelock, cvx } = fixture;
      await harvester.connect(timelock).swapRewardToken(cvx.address);
    });

    it("Should swap COMP", async () => {
      const { harvester, timelock, comp } = fixture;
      await harvester.connect(timelock).swapRewardToken(comp.address);
    });

    it("Should swap AAVE", async () => {
      const { harvester, timelock, aave } = fixture;
      await harvester.connect(timelock).swapRewardToken(aave.address);
    });

    // TODO: Tests for `harvest(address)` for each strategy
  });
});
