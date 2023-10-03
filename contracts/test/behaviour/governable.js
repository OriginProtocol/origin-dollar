const { expect } = require("chai");
const { daiUnits } = require("../helpers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * @example
   shouldBehaveLikeGovernanble(() => ({
      ...fixture,
      strategy: fixture.convexStrategy,
    }));
 */
const shouldBehaveLikeGovernable = (context) => {
  describe("Governable", () => {
    it("Should have governor set", async () => {
      const { governor, strategy } = context();
      expect(await strategy.governor()).to.equal(governor.address);
    });
    it("Should detect if governor set or not", async () => {
      const { governor, anna, strategist, strategy } = context();
      expect(await strategy.connect(governor).isGovernor()).to.be.true;

      for (const signer of [strategist, anna]) {
        expect(await strategy.connect(signer).isGovernor()).to.be.false;
      }
    });
    it("Should allow transfer of arbitrary token by Governor", async () => {
      const { governor, anna, dai, strategy } = context();
      const governorDaiBalanceBefore = await dai.balanceOf(governor.address);
      const strategyDaiBalanceBefore = await dai.balanceOf(strategy.address);

      // Anna accidently sends DAI to strategy
      const recoveryAmount = daiUnits("800");
      await dai.connect(anna).transfer(strategy.address, recoveryAmount);

      // Anna asks Governor for help
      await strategy
        .connect(governor)
        .transferToken(dai.address, recoveryAmount);
      await expect(governor).has.a.balanceOf(
        governorDaiBalanceBefore.add(recoveryAmount),
        dai
      );
      await expect(strategy).has.a.balanceOf(strategyDaiBalanceBefore, dai);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      const { strategist, anna, dai, strategy } = context();

      const recoveryAmount = daiUnits("800");
      for (const signer of [strategist, anna]) {
        // Naughty signer
        await expect(
          strategy.connect(signer).transferToken(dai.address, recoveryAmount)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow governor to transfer governance", async () => {
      const { governor, anna, strategy } = context();

      expect(await strategy.governor()).to.equal(governor.address);
      await strategy.connect(governor).transferGovernance(anna.address);
      // The governor should be the same as it needs to be claimed
      expect(await strategy.governor()).to.equal(governor.address);

      await strategy.connect(anna).claimGovernance();
      expect(await strategy.governor()).to.equal(anna.address);
    });

    it("Should not allow anyone to transfer governance", async () => {
      const { governor, anna, strategist, strategy } = context();

      expect(await strategy.governor()).to.equal(governor.address);

      for (const signer of [strategist, anna]) {
        // Naughty signer
        await expect(
          strategy.connect(signer).transferGovernance(signer.address)
        ).to.be.revertedWith("Caller is not the Governor");

        // The governor should be the same as it needs to be claimed
        expect(await strategy.governor()).to.equal(governor.address);
      }
    });

    it("Should not allow anyone to claim governance", async () => {
      const { governor, anna, josh, strategist, strategy } = context();

      expect(await strategy.governor()).to.equal(governor.address);
      await strategy.connect(governor).transferGovernance(josh.address);

      for (const signer of [strategist, anna]) {
        // Naughty signer
        await expect(
          strategy.connect(signer).claimGovernance()
        ).to.be.revertedWith(
          "Only the pending Governor can complete the claim"
        );

        // The governor should be the same as it is still to be claimed
        expect(await strategy.governor()).to.equal(governor.address);
      }
    });

    it("Should allow governor to transfer governance multiple times", async () => {
      const { governor, anna, josh, matt, strategy } = context();

      expect(await strategy.governor()).to.equal(governor.address);
      await strategy.connect(governor).transferGovernance(anna.address);
      await strategy.connect(governor).transferGovernance(josh.address);
      await strategy.connect(governor).transferGovernance(matt.address);
      // The governor should be the same as it needs to be claimed
      expect(await strategy.governor()).to.equal(governor.address);

      // Josh was not the last to be transferred the governance so can not claim
      await expect(strategy.connect(josh).claimGovernance()).to.be.revertedWith(
        "Only the pending Governor can complete the claim"
      );
      await strategy.connect(matt).claimGovernance();
      expect(await strategy.governor()).to.equal(matt.address);
    });
  });
};

module.exports = {
  shouldBehaveLikeGovernable,
};
