const { expect } = require("chai");

const { isFork, units } = require("../helpers");
const { setERC20TokenBalance } = require("../_fund");
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns:
 *    - strategy: Strategy to test against
 *    - harvester: OUSD Harvester or OETH Harvester
 *    - dripper: Dripper
 *    - fixture: The actual fixture
 * @example
 *  shouldHarvestRewardTokens(() => ({
 *      fixture,
 *      harvester,
 *      dripper,
 *      strategy
 *  }));
 */
const shouldHarvestRewardTokens = (context) => {
  if (!isFork) {
    // Only meant to be used on fork
    return;
  }

  describe("Reward Tokens", () => {
    it("Should collect and send reward tokens to harvester", async () => {
      const { strategy, harvester } = context();

      const harvesterSigner = await impersonateAndFund(harvester.address);

      const rewardTokens = await strategy.getRewardTokenAddresses();
      const harvesterBalBefore = [];

      for (let i = 0; i < rewardTokens.length; i++) {
        const token = await ethers.getContractAt("IERC20", rewardTokens[i]);
        // Send some rewards to the strategy
        await setERC20TokenBalance(strategy.address, token, "1000");
        harvesterBalBefore[i] = await token.balanceOf(harvester.address);
        rewardTokens[i] = token;
      }

      const tx = await strategy.connect(harvesterSigner).collectRewardTokens();
      await expect(tx).to.emit(strategy, "RewardTokenCollected");

      // Should've transferred everything to Harvester
      for (let i = 0; i < rewardTokens.length; i++) {
        const token = rewardTokens[i];
        expect(await token.balanceOf(strategy.address)).to.eq("0");
        expect(await token.balanceOf(harvester.address)).to.be.gte(
          harvesterBalBefore[i].add(await units("1000", token))
        );
      }
    });

    it("Should swap reward tokens", async () => {
      const { strategy, harvester, fixture } = context();
      const { strategist } = fixture;

      const rewardTokens = await strategy.getRewardTokenAddresses();

      let i = 0;
      for (const tokenAddr of rewardTokens) {
        const token = await ethers.getContractAt("IERC20", tokenAddr);
        // Send some rewards to the strategy
        await setERC20TokenBalance(strategy.address, token);

        rewardTokens[i++] = token;
      }

      // Trigger the swap
      // prettier-ignore
      const tx = await harvester
        .connect(strategist)["harvestAndSwap(address)"](strategy.address);

      // Make sure the events have been emitted
      await expect(tx).to.emit(strategy, "RewardTokenCollected");
      await expect(tx).to.emit(harvester, "RewardTokenSwapped");
      await expect(tx).to.emit(harvester, "RewardProceedsTransferred");

      // Should've transferred everything to Harvester
      for (const token of rewardTokens) {
        expect(await token.balanceOf(strategy.address)).to.eq("0");
      }
    });
  });
};

module.exports = {
  shouldHarvestRewardTokens,
};
