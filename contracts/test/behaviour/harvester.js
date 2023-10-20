const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;

const { units } = require("../helpers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - rewards: array of objects with asset and expected properties
 * @example
    shouldBehaveLikeHarvester(() => ({
      ...fixture,
      strategy: fixture.convexEthMetaStrategy,
      harvester: fixture.oethHarvester,
      vault: fixture.oethVault,
      dripAsset: fixture.weth,
      rewards: [
        { asset: fixture.crv, expected: parseUnits("2") },
        { asset: fixture.cvx, expected: parseUnits("3") },
      ],
    }));
 */
const shouldBehaveLikeHarvester = (context) => {
  describe("Harvester behaviour", () => {
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
        await expect(harvester).to.have.balanceOf("0", reward.asset);
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
      it("Should collect and swap using harvestAndSwap()", async () => {
        await harvestAndSwapTokens(true);
      });

      it("Should collect and swap using harvestAndSwap(strategy_address)", async () => {
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
        dripAsset,
        vault,
        strategy,
      } = context();

      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
      await mockUniswapRouter.initialize(
        [crv.address, cvx.address],
        [dripAsset.address, dripAsset.address]
      );

      // Make sure Vault has 0 drip assets
      await expect(vault).has.a.balanceOf("0", dripAsset);
      await expect(vault).has.a.balanceOf("0", crv);
      await expect(vault).has.a.balanceOf("0", cvx);

      // Give Uniswap mock some drip assets so it can give it back in CRV liquidation
      await dripAsset
        .connect(anna)
        .transfer(mockUniswapRouter.address, units("1000", dripAsset));

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

      const balanceBeforeAnna = await dripAsset.balanceOf(anna.address);

      if (callAsGovernor) {
        const dripAssetsInVaultExpected =
          rewards.length > 1
            ? "2.3" // 0.8 + 1.5
            : "0.8";
        // prettier-ignore
        await harvester
            .connect(governor)["harvestAndSwap()"]();
        await expect(vault).has.a.balanceOf(
          dripAssetsInVaultExpected,
          dripAsset
        );
      } else {
        // prettier-ignore
        await harvester
            .connect(anna)["harvestAndSwap(address)"](strategy.address);

        const dripAssetsInVaultExpected =
          rewards.length > 1
            ? "2.277" // (0.8 + 1.5) - 1%
            : "0.792";
        await expect(vault).has.a.balanceOf(
          dripAssetsInVaultExpected,
          dripAsset
        );

        const dripAssetToHarvesterExpected =
          rewards.length > 1
            ? await units("0.023", dripAsset) // 2.3* 1% = 0.023
            : await units("0.008", dripAsset); // 0.8 * 1% = 0.08
        const balanceAfterAnna = await dripAsset.balanceOf(anna.address);
        await expect(balanceAfterAnna.sub(balanceBeforeAnna)).to.be.equal(
          dripAssetToHarvesterExpected
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
