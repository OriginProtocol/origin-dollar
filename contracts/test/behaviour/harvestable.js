const { expect } = require("chai");

const { impersonateAndFund } = require("../../utils/signers");

/**
 * Tests a strategy contract implements the Harvester functions
 * @param {*} context a function that returns a fixture with the additional properties:
 * - harvester: the OUSD or OETH harvester contract.
 * - strategy: the strategy to test
 * @example
    shouldBehaveLikeHarvester(() => ({
      ...fixture,
      harvester: fixture.oethHarvester
      strategy: fixture.nativeStakingSSVStrategy,
    }));
 */
const shouldBehaveLikeHarvestable = (context) => {
  describe("Harvestable behaviour", () => {
    it("Should allow rewards to be collect from the strategy by the harvester", async () => {
      const { harvester, strategy } = context();

      const harvesterSigner = await impersonateAndFund(harvester.address);
      await strategy.connect(harvesterSigner).collectRewardTokens();
    });

    it("Should allow strategist to collect rewards", async () => {
      const { strategist, strategy } = context();
      await strategy.connect(strategist).collectRewardTokens();
    });

    it("Should NOT allow rewards to be collected by non-harvester", async () => {
      const { anna, governor, strategy } = context();

      for (const signer of [anna, governor]) {
        await expect(
          strategy.connect(signer).collectRewardTokens()
        ).to.be.revertedWith("Caller is not the Harvester or Strategist");
      }
    });

    it("Should revert when zero address attempts to be set as reward token address", async () => {
      const { strategy, governor, oeth } = context();

      await expect(
        strategy
          .connect(governor)
          .setRewardTokenAddresses([
            oeth.address,
            "0x0000000000000000000000000000000000000000",
          ])
      ).to.be.revertedWith("Can not set an empty address as a reward token");
    });

    describe("pauseHarvester / unpauseHarvester", () => {
      it("Governor can pause and emits HarvesterPaused", async () => {
        const { governor, strategy } = context();
        await expect(strategy.connect(governor).pauseHarvester())
          .to.emit(strategy, "HarvesterPaused")
          .withArgs(governor.address);
        expect(await strategy.harvesterPaused()).to.be.true;
      });

      it("Strategist can pause", async () => {
        const { strategist, strategy } = context();
        await strategy.connect(strategist).pauseHarvester();
        expect(await strategy.harvesterPaused()).to.be.true;
      });

      it("Random address cannot pause", async () => {
        const { anna, strategy } = context();
        await expect(
          strategy.connect(anna).pauseHarvester()
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      });

      it("Governor can unpause and emits HarvesterUnpaused", async () => {
        const { governor, strategy } = context();
        await strategy.connect(governor).pauseHarvester();
        await expect(strategy.connect(governor).unpauseHarvester())
          .to.emit(strategy, "HarvesterUnpaused")
          .withArgs(governor.address);
        expect(await strategy.harvesterPaused()).to.be.false;
      });

      it("Strategist cannot unpause", async () => {
        const { governor, strategist, strategy } = context();
        await strategy.connect(governor).pauseHarvester();
        await expect(
          strategy.connect(strategist).unpauseHarvester()
        ).to.be.revertedWith("Caller is not the Governor");
      });

      it("Random address cannot unpause", async () => {
        const { governor, anna, strategy } = context();
        await strategy.connect(governor).pauseHarvester();
        await expect(
          strategy.connect(anna).unpauseHarvester()
        ).to.be.revertedWith("Caller is not the Governor");
      });

      it("collectRewardTokens succeeds but skips transfer when paused", async () => {
        const { governor, harvester, strategy } = context();
        await strategy.connect(governor).pauseHarvester();
        // Should not revert — call succeeds, just no-ops the transfer
        const harvesterSigner = await impersonateAndFund(harvester.address);
        await strategy.connect(harvesterSigner).collectRewardTokens();
      });
    });
  });
};

module.exports = {
  shouldBehaveLikeHarvestable,
};
