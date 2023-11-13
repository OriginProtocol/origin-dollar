const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;

const { usdtUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - rewards: array of objects with asset and expected properties
 * @example
    shouldBehaveLikeHarvester(() => ({
        ...fixture,
        strategy: fixture.convexStrategy,
        rewards: [
        { asset: fixture.crv, expected: parseUnits("2") },
        { asset: fixture.cvx, expected: parseUnits("3") },
        ],
    }));
 */
const shouldBehaveLikeHarvester = (context) => {
  describe("Harvester behaviour", () => {
    it("Should allow rewards to be collect from the strategy by the harvester", async () => {
      const { harvester, strategy } = context();

      const harvesterSigner = await impersonateAndFund(harvester.address);
      await strategy.connect(harvesterSigner).collectRewardTokens();
    });
    it("Should NOT allow rewards to be collected by non-harvester", async () => {
      const { anna, governor, strategist, strategy } = context();

      for (const signer of [anna, governor, strategist]) {
        await expect(
          strategy.connect(signer).collectRewardTokens()
        ).to.be.revertedWith("Caller is not the Harvester");
      }
    });
    it("Should allow the governor to call harvest for a specific strategy", async () => {
      const { harvester, governor, strategy } = context();
      // prettier-ignore
      await harvester
          .connect(governor)["harvest(address)"](strategy.address);
    });

    it("Should collect reward tokens using collect rewards on all strategies", async () => {
      const { harvester, governor, rewards } = context();

      // No rewards in the harvester before harvest
      for (const reward of rewards) {
        await expect(harvester).to.have.balanceOf(0, reward.asset);
      }

      // Harvest rewards from all strategies
      await harvester.connect(governor)["harvest()"]();

      // Check all the rewards were harvested
      for (const reward of rewards) {
        await expect(
          await reward.asset.balanceOf(harvester.address)
        ).to.be.equal(reward.expected);
      }
    });

    it("Should collect all reward tokens even though the swap limits are set", async () => {
      const { harvester, governor, rewards } = context();
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

      for (const reward of rewards) {
        await expect(
          harvester
            .connect(governor)
            .setRewardTokenConfig(
              reward.asset.address,
              300,
              100,
              mockUniswapRouter.address,
              parseUnits("1", 18),
              true
            )
        )
          .to.emit(harvester, "RewardTokenConfigUpdated")
          .withArgs(
            reward.asset.address,
            300,
            100,
            mockUniswapRouter.address,
            parseUnits("1", 18),
            true
          );
      }

      // Mint of MockCRVMinter mints a fixed 2e18
      await harvester.connect(governor)["harvest()"]();

      for (const reward of rewards) {
        await expect(
          await reward.asset.balanceOf(harvester.address)
        ).to.be.equal(reward.expected);
      }
    });

    it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
      const { harvester, governor, rewards, strategy } = context();

      await harvester.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](strategy.address);

      for (const reward of rewards) {
        await expect(
          await reward.asset.balanceOf(harvester.address)
        ).to.be.equal(reward.expected);
      }
    });

    describe("harvest using Uniswap considering liquidation limits", () => {
      it("Should collect and swap using harvestAndSwap() by governor", async () => {
        await harvestAndSwapTokens(true);
      });

      it("Should collect and swap using harvestAndSwap(strategy_address) by anyone", async () => {
        await harvestAndSwapTokens(false);
      });
    });

    const harvestAndSwapTokens = async (callAsGovernor) => {
      const {
        anna,
        harvester,
        governor,
        rewards,
        crv,
        cvx,
        usdt,
        vault,
        strategy,
      } = context();

      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
      await mockUniswapRouter.initialize(
        [crv.address, cvx.address],
        [usdt.address, usdt.address]
      );

      // Make sure Vault has 0 USDT balance
      await expect(vault).has.a.balanceOf("0", usdt);
      await expect(vault).has.a.balanceOf("0", crv);
      await expect(vault).has.a.balanceOf("0", cvx);

      // Give Uniswap mock some USDT so it can give it back in CRV liquidation
      await usdt
        .connect(anna)
        .transfer(mockUniswapRouter.address, usdtUnits("1000"));

      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          rewards[0].asset.address,
          300,
          100,
          mockUniswapRouter.address,
          parseUnits("0.8", 18),
          true
        );

      if (rewards.length > 1) {
        await harvester
          .connect(governor)
          .setRewardTokenConfig(
            rewards[1].asset.address,
            300,
            100,
            mockUniswapRouter.address,
            parseUnits("1.5", 18),
            true
          );
      }

      const reward1Config = await harvester.rewardTokenConfigs(
        rewards[0].asset.address
      );
      expect(reward1Config.liquidationLimit).to.equal(parseUnits("0.8", 18));

      if (rewards.length > 1) {
        const reward2Config = await harvester.rewardTokenConfigs(
          rewards[1].asset.address
        );
        expect(reward2Config.liquidationLimit).to.equal(parseUnits("1.5", 18));
      }

      const balanceBeforeAnna = await usdt.balanceOf(anna.address);

      if (callAsGovernor) {
        const usdtInVaultExpected =
          rewards.length > 1
            ? "2.3" // 0.8 + 1.5
            : "0.8";
        // prettier-ignore
        await harvester
            .connect(governor)["harvestAndSwap()"]();
        await expect(vault).has.a.balanceOf(usdtInVaultExpected, usdt);

        await expect(
          harvester.connect(anna)["harvestAndSwap()"]()
        ).to.be.revertedWith("Caller is not the Governor");
      } else {
        // prettier-ignore
        await harvester
            .connect(anna)["harvestAndSwap(address)"](strategy.address);

        const usdtInVaultExpected =
          rewards.length > 1
            ? "2.277" // (0.8 + 1.5) - 1%
            : "0.792";
        await expect(vault).has.a.balanceOf(usdtInVaultExpected, usdt);

        const usdtToHarvesterExpected =
          rewards.length > 1
            ? "0.023" // 2.3* 1% = 0.023
            : "0.008"; // 0.8 * 1% = 0.08
        const balanceAfterAnna = await usdt.balanceOf(anna.address);
        await expect(balanceAfterAnna - balanceBeforeAnna).to.be.equal(
          parseUnits(usdtToHarvesterExpected, 6)
        );
      }

      await expect(harvester).has.a.balanceOf("1.2", rewards[0].asset);
      await expect(
        await rewards[0].asset.balanceOf(strategy.address)
      ).to.be.equal("0");

      if (rewards.length > 1) {
        await expect(harvester).has.a.balanceOf("1.5", rewards[1].asset);
        await expect(
          await rewards[1].asset.balanceOf(strategy.address)
        ).to.be.equal("0");
      }
    };

    it("Should revert when zero address attempts to be set as reward token address", async () => {
      const { strategy, governor, rewards } = context();

      await expect(
        strategy
          .connect(governor)
          .setRewardTokenAddresses([
            rewards[0].asset.address,
            "0x0000000000000000000000000000000000000000",
          ])
      ).to.be.revertedWith("Can not set an empty address as a reward token");
    });
  });
};

module.exports = {
  shouldBehaveLikeHarvester,
};
