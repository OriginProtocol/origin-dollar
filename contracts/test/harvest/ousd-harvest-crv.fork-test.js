const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;

const { usdtUnits } = require("../helpers");
const { loadDefaultFixture } = require("../_fixture");
const { MAX_UINT256 } = require("../../utils/constants");

describe("ForkTest: Harvest OUSD", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe.skip("deploy script CRV liquidation limit", function () {
    it("config", async function () {
      const { crv, harvester } = fixture;
      const crvTokenConfig = await harvester.rewardTokenConfigs(crv.address);
      expect(crvTokenConfig.liquidationLimit).to.be.eq(parseUnits("4000", 18));
    });
    it("should harvest", async function () {
      const { crv, timelock, harvester, OUSDmetaStrategy } = fixture;

      const balanceBeforeHarvest = await crv.balanceOf(harvester.address);

      // prettier-ignore
      await harvester
        .connect(timelock)["harvest(address)"](OUSDmetaStrategy.address);

      const balanceAfterHarvest = await crv.balanceOf(harvester.address);

      const crvHarvested = balanceAfterHarvest.sub(balanceBeforeHarvest);
      expect(crvHarvested).to.be.gt(parseUnits("20000", 18));
    });
    it("should harvest and swap", async function () {
      const { anna, OUSDmetaStrategy, dripper, harvester, usdt } = fixture;

      const usdtBalanceBeforeDripper = await usdt.balanceOf(dripper.address);

      // prettier-ignore
      await harvester
        .connect(anna)["harvestAndSwap(address)"](OUSDmetaStrategy.address);

      const usdtBalanceAfterDripper = await usdt.balanceOf(dripper.address);
      const usdtSwapped = usdtBalanceAfterDripper.sub(usdtBalanceBeforeDripper);
      await expect(usdtSwapped).to.be.gt(usdtUnits("3100"));
    });
  });
  describe.skip("no CRV liquidation limit", function () {
    beforeEach(async () => {
      const { crv, harvester, timelock } = fixture;

      const oldCrvTokenConfig = await harvester.rewardTokenConfigs(crv.address);
      await harvester.connect(timelock).setRewardTokenConfig(
        crv.address,
        oldCrvTokenConfig.allowedSlippageBps,
        oldCrvTokenConfig.harvestRewardBps,
        0, // Uniswap V2 compatible
        oldCrvTokenConfig.swapPlatformAddr,
        MAX_UINT256,
        oldCrvTokenConfig.doSwapRewardToken
      );
    });
    /*
     * Skipping this test as it should only fail on a specific block number, where
     * there is:
     *  - no liquidation limit
     *  - strategy has accrued a lot of CRV rewards
     *  - depth of the SushiSwap pool is not deep enough to handle the swap without
     *    hitting the slippage limit.
     */
    it("should not harvest and swap", async function () {
      const { anna, OUSDmetaStrategy, harvester } = fixture;

      // prettier-ignore
      const tx = harvester
        .connect(anna)["harvestAndSwap(address)"](OUSDmetaStrategy.address);
      await expect(tx).to.be.revertedWith(
        "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
      );
    });
  });
  describe.skip("CRV liquidation limit", function () {
    const crvLimit = 4000;
    beforeEach(async () => {
      const { crv, harvester, timelock } = fixture;

      const oldCrvTokenConfig = await harvester.rewardTokenConfigs(crv.address);

      await harvester.connect(timelock).setRewardTokenConfig(
        crv.address,
        oldCrvTokenConfig.allowedSlippageBps,
        oldCrvTokenConfig.harvestRewardBps,
        0, // Uniswap V2 compatible
        oldCrvTokenConfig.swapPlatformAddr,
        parseUnits(crvLimit.toString(), 18),
        oldCrvTokenConfig.doSwapRewardToken
      );
    });
    /*
     * Skipping this test as it will only succeed again on a specific block number.
     * If strategy doesn't have enough CRV not nearly enough rewards are going to be
     * harvested for the test to pass.
     */
    it("should harvest and swap", async function () {
      const { crv, OUSDmetaStrategy, dripper, harvester, timelock, usdt } =
        fixture;

      const balanceBeforeDripper = await usdt.balanceOf(dripper.address);

      // prettier-ignore
      await harvester
        .connect(timelock)["harvest(address)"](OUSDmetaStrategy.address);
      await harvester.connect(timelock).swapRewardToken(crv.address);

      const balanceAfterDripper = await usdt.balanceOf(dripper.address);
      const usdtSwapped = balanceAfterDripper.sub(balanceBeforeDripper);

      await expect(usdtSwapped, "USDT received").to.be.gt(
        usdtUnits((crvLimit * 0.79).toString())
      );
    });
  });
});
