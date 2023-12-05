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
      strategy: fixture.convexEthMetaStrategy,
    }));
 */
const shouldBehaveLikeHarvestable = (context) => {
  describe("Harvestable behaviour", () => {
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
  });
};

module.exports = {
  shouldBehaveLikeHarvestable,
};
