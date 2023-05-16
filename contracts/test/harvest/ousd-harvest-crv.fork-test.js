const { expect } = require("chai");
const { parseUnits, formatUnits } = require("ethers").utils;

const { loadFixture } = require("ethereum-waffle");
const { forkOnlyDescribe, usdtUnits } = require("../helpers");
const { defaultFixture } = require("../_fixture");
const { MAX_UINT256 } = require("../../utils/constants");

forkOnlyDescribe("ForkTest: Harvest OUSD", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    console.log(`load fixture`);
    fixture = await loadFixture(defaultFixture);
  });

  describe.skip("deploy script CRV liquidation limit", function () {
    it("config", async function () {
      const { crv, harvester } = fixture;
      const crvTokenConfig = await harvester.rewardTokenConfigs(crv.address);
      console.log(
        `CRV swap limit: ${formatUnits(crvTokenConfig.liquidationLimit, 18)}`
      );
      expect(crvTokenConfig.liquidationLimit).to.be.eq(parseUnits("4000", 18));
    });
    it("should harvest", async function () {
      const { crv, timelock, harvester, OUSDmetaStrategy } = fixture;

      const balanceBeforeHarvest = await crv.balanceOf(harvester.address);

      await harvester
        .connect(timelock)
        ["harvest(address)"](OUSDmetaStrategy.address);

      const balanceAfterHarvest = await crv.balanceOf(harvester.address);

      const crvHarvested = balanceAfterHarvest.sub(balanceBeforeHarvest);
      console.log(`harvested ${formatUnits(crvHarvested, 18)} CRV`);

      expect(balanceAfterHarvest.sub(balanceBeforeHarvest)).to.be.gt(
        parseUnits("20000", 18)
      );
    });
    it("should harvest and swap", async function () {
      const { anna, OUSDmetaStrategy, dripper, harvester, usdt } = fixture;

      const usdtBalanceBeforeDripper = await usdt.balanceOf(dripper.address);

      await harvester
        .connect(anna)
        ["harvestAndSwap(address)"](OUSDmetaStrategy.address);

      const usdtBalanceAfterDripper = await usdt.balanceOf(dripper.address);
      const usdtSwapped = usdtBalanceAfterDripper.sub(usdtBalanceBeforeDripper);
      await expect(usdtSwapped).to.be.gt(usdtUnits("3100"));
    });
  });
  describe("no CRV liquidation limit", function () {
    beforeEach(async () => {
      const { crv, harvester, timelock } = fixture;

      const oldCrvTokenConfig = await harvester.rewardTokenConfigs(crv.address);
      await harvester
        .connect(timelock)
        .setRewardTokenConfig(
          crv.address,
          oldCrvTokenConfig.allowedSlippageBps,
          oldCrvTokenConfig.harvestRewardBps,
          oldCrvTokenConfig.uniswapV2CompatibleAddr,
          MAX_UINT256,
          oldCrvTokenConfig.doSwapRewardToken
        );
    });
    it("should not harvest and swap", async function () {
      const { anna, OUSDmetaStrategy, harvester } = fixture;

      const tx = harvester
        .connect(anna)
        ["harvestAndSwap(address)"](OUSDmetaStrategy.address);
      await expect(tx).to.be.revertedWith(
        "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
      );
    });
  });
  describe("CRV liquidation limit", function () {
    const crvLimit = 4000;
    beforeEach(async () => {
      const { crv, harvester, timelock } = fixture;

      const oldCrvTokenConfig = await harvester.rewardTokenConfigs(crv.address);
      console.log(`allowed slippage ${oldCrvTokenConfig.allowedSlippageBps}`);
      console.log(`harvest reward ${oldCrvTokenConfig.harvestRewardBps}`);

      await harvester
        .connect(timelock)
        .setRewardTokenConfig(
          crv.address,
          oldCrvTokenConfig.allowedSlippageBps,
          oldCrvTokenConfig.harvestRewardBps,
          oldCrvTokenConfig.uniswapV2CompatibleAddr,
          parseUnits(crvLimit.toString(), 18),
          oldCrvTokenConfig.doSwapRewardToken
        );
    });
    it("should harvest and swap", async function () {
      const { crv, OUSDmetaStrategy, dripper, harvester, timelock, usdt } =
        fixture;
      console.log(`CRV swap limit: ${crvLimit}`);

      const balanceBeforeDripper = await usdt.balanceOf(dripper.address);

      await harvester
        .connect(timelock)
        ["harvest(address)"](OUSDmetaStrategy.address);
      await harvester.connect(timelock).swapRewardToken(crv.address);

      const balanceAfterDripper = await usdt.balanceOf(dripper.address);
      const usdtSwapped = balanceAfterDripper.sub(balanceBeforeDripper);
      const rate = usdtSwapped
        .mul(parseUnits("1", 30))
        .div(parseUnits(crvLimit.toString(), 18));
      console.log(
        `swapped ${crvLimit} CRV for ${formatUnits(
          usdtSwapped,
          6
        )} USDT at rate ${formatUnits(rate, 18)} CRV/USDT`
      );
      await expect(usdtSwapped, "USDT received").to.be.gt(
        usdtUnits((crvLimit * 0.79).toString())
      );
    });
  });
});
