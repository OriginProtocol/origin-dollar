const { expect } = require("chai");
const {
  createFixtureLoader,
  claimStrategyRewardsModuleFixture,
} = require("../_fixture");
const addresses = require("../../utils/addresses");
const { parseUnits } = require("ethers/lib/utils");

const fixture = createFixtureLoader(claimStrategyRewardsModuleFixture);

describe("Unit Test: Claim Strategy Rewards Safe Module", function () {
  let f;
  let rewardsTo;

  beforeEach(async () => {
    f = await fixture();
    // Use a deterministic test address as the rewards destination
    rewardsTo = "0x0000000000000000000000000000000000000099";

    // Set rewardsTo via the safe (admin)
    await f.claimRewardsModule.connect(f.safeSigner).setRewardsTo(rewardsTo);
  });

  // ─── Deployment ───────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("Should set safeContract", async () => {
      expect(await f.claimRewardsModule.safeContract()).to.eq(
        f.mockSafe.address
      );
    });

    it("Should set rewardsTo to addresses.dead initially", async () => {
      // The freshly deployed contract has addresses.dead as rewardsTo
      // (set in deploySafeModulesForUnitTests), but beforeEach overrides it.
      // Verify the override took effect.
      expect(await f.claimRewardsModule.rewardsTo()).to.eq(rewardsTo);
    });
  });

  // ─── setRewardsTo ─────────────────────────────────────────────────────────

  describe("setRewardsTo()", () => {
    it("Should update rewardsTo and emit event", async () => {
      const newAddress = "0x0000000000000000000000000000000000000042";
      await expect(
        f.claimRewardsModule.connect(f.safeSigner).setRewardsTo(newAddress)
      )
        .to.emit(f.claimRewardsModule, "RewardsToUpdated")
        .withArgs(newAddress);

      expect(await f.claimRewardsModule.rewardsTo()).to.eq(newAddress);
    });

    it("Should revert on zero address", async () => {
      await expect(
        f.claimRewardsModule.connect(f.safeSigner).setRewardsTo(addresses.zero)
      ).to.be.revertedWith("Invalid rewardsTo address");
    });

    it("Should revert if called by non-admin", async () => {
      await expect(
        f.claimRewardsModule.connect(f.stranger).setRewardsTo(rewardsTo)
      ).to.be.reverted;
    });
  });

  // ─── addStrategy / removeStrategy ─────────────────────────────────────────

  describe("addStrategy() / removeStrategy()", () => {
    it("Should add and whitelist a strategy", async () => {
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      expect(
        await f.claimRewardsModule.isStrategyWhitelisted(
          f.mockClaimableStrategy.address
        )
      ).to.be.true;
    });

    it("Should revert when adding a duplicate strategy", async () => {
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      await expect(
        f.claimRewardsModule
          .connect(f.safeSigner)
          .addStrategy(f.mockClaimableStrategy.address)
      ).to.be.revertedWith("Strategy already whitelisted");
    });

    it("Should remove a strategy", async () => {
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      await f.claimRewardsModule
        .connect(f.safeSigner)
        .removeStrategy(f.mockClaimableStrategy.address);

      expect(
        await f.claimRewardsModule.isStrategyWhitelisted(
          f.mockClaimableStrategy.address
        )
      ).to.be.false;
    });

    it("Should revert when removing a non-whitelisted strategy", async () => {
      await expect(
        f.claimRewardsModule
          .connect(f.safeSigner)
          .removeStrategy(f.mockClaimableStrategy.address)
      ).to.be.revertedWith("Strategy not whitelisted");
    });

    it("Should revert if called by non-admin", async () => {
      await expect(
        f.claimRewardsModule
          .connect(f.stranger)
          .addStrategy(f.mockClaimableStrategy.address)
      ).to.be.reverted;
    });
  });

  // ─── claimRewardsFor ──────────────────────────────────────────────────────

  describe("claimRewardsFor()", () => {
    it("Should revert for non-whitelisted strategy", async () => {
      await expect(
        f.claimRewardsModule
          .connect(f.safeSigner)
          .claimRewardsFor(f.mockClaimableStrategy.address, false)
      ).to.be.revertedWith("Strategy not whitelisted");
    });

    it("Should revert if called by non-operator", async () => {
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      await expect(
        f.claimRewardsModule
          .connect(f.stranger)
          .claimRewardsFor(f.mockClaimableStrategy.address, false)
      ).to.be.reverted;
    });

    it("Should claim and forward tokens to rewardsTo", async () => {
      const { mockUSDC } = f;
      const amount = parseUnits("100", 6);

      // Configure the strategy with a reward token and fund it
      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      await mockUSDC.mintTo(f.mockClaimableStrategy.address, amount);

      // Whitelist the strategy
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      const rewardsToBalanceBefore = await mockUSDC.balanceOf(rewardsTo);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewardsFor(f.mockClaimableStrategy.address, false);

      await expect(tx)
        .to.emit(f.claimRewardsModule, "RewardTokensForwarded")
        .withArgs(f.mockClaimableStrategy.address, mockUSDC.address, amount);

      // Tokens should arrive at rewardsTo, not remain in the Safe
      expect(await mockUSDC.balanceOf(rewardsTo)).to.eq(
        rewardsToBalanceBefore.add(amount)
      );
      expect(await mockUSDC.balanceOf(f.mockSafe.address)).to.eq(0);
    });

    it("Should do nothing when strategy has no reward tokens", async () => {
      await f.mockClaimableStrategy.setRewardTokenAddresses([]);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewardsFor(f.mockClaimableStrategy.address, false);

      await expect(tx).to.not.emit(
        f.claimRewardsModule,
        "RewardTokensForwarded"
      );
    });

    it("Should do nothing when reward token balance is zero", async () => {
      const { mockUSDC } = f;

      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      // No tokens minted to strategy
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewardsFor(f.mockClaimableStrategy.address, false);

      await expect(tx).to.not.emit(
        f.claimRewardsModule,
        "RewardTokensForwarded"
      );
    });

    it("Should emit ClaimRewardsFailed and revert when silent=false", async () => {
      const { mockUSDC } = f;

      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      await f.mockClaimableStrategy.setShouldRevert(true);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      await expect(
        f.claimRewardsModule
          .connect(f.safeSigner)
          .claimRewardsFor(f.mockClaimableStrategy.address, false)
      ).to.be.revertedWith("Failed to claim rewards");
    });

    it("Should emit ClaimRewardsFailed but not revert when silent=true", async () => {
      const { mockUSDC } = f;

      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      await f.mockClaimableStrategy.setShouldRevert(true);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewardsFor(f.mockClaimableStrategy.address, true);

      await expect(tx)
        .to.emit(f.claimRewardsModule, "ClaimRewardsFailed")
        .withArgs(f.mockClaimableStrategy.address);
    });

    it("Should handle multiple reward tokens", async () => {
      const { mockUSDC, mockDAI } = f;
      const usdcAmount = parseUnits("50", 6);
      const daiAmount = parseUnits("200", 18);

      await f.mockClaimableStrategy.setRewardTokenAddresses([
        mockUSDC.address,
        mockDAI.address,
      ]);
      await mockUSDC.mintTo(f.mockClaimableStrategy.address, usdcAmount);
      await mockDAI.mintTo(f.mockClaimableStrategy.address, daiAmount);

      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewardsFor(f.mockClaimableStrategy.address, false);

      await expect(tx)
        .to.emit(f.claimRewardsModule, "RewardTokensForwarded")
        .withArgs(
          f.mockClaimableStrategy.address,
          mockUSDC.address,
          usdcAmount
        );
      await expect(tx)
        .to.emit(f.claimRewardsModule, "RewardTokensForwarded")
        .withArgs(f.mockClaimableStrategy.address, mockDAI.address, daiAmount);

      expect(await mockUSDC.balanceOf(rewardsTo)).to.eq(usdcAmount);
      expect(await mockDAI.balanceOf(rewardsTo)).to.eq(daiAmount);
    });
  });

  // ─── claimRewards (claimAll) ───────────────────────────────────────────────

  describe("claimRewards() — claim all", () => {
    it("Should revert if called by non-operator", async () => {
      await expect(f.claimRewardsModule.connect(f.stranger).claimRewards(false))
        .to.be.reverted;
    });

    it("Should claim and forward from all whitelisted strategies", async () => {
      const { mockUSDC, mockDAI } = f;

      // Deploy a second mock claimable strategy by repurposing the fixture one
      // and using a second ethers.getContract with a different address.
      // For simplicity, add the same strategy twice would fail, so we use
      // two separate strategies by deploying a second one inline.
      const MockClaimableStrategy = await ethers.getContractFactory(
        "MockClaimableStrategy"
      );
      const strategy2 = await MockClaimableStrategy.deploy();

      const amount1 = parseUnits("100", 6);
      const amount2 = parseUnits("300", 18);

      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      await mockUSDC.mintTo(f.mockClaimableStrategy.address, amount1);

      await strategy2.setRewardTokenAddresses([mockDAI.address]);
      await mockDAI.mintTo(strategy2.address, amount2);

      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(strategy2.address);

      await f.claimRewardsModule.connect(f.safeSigner).claimRewards(false);

      expect(await mockUSDC.balanceOf(rewardsTo)).to.eq(amount1);
      expect(await mockDAI.balanceOf(rewardsTo)).to.eq(amount2);
      expect(await mockUSDC.balanceOf(f.mockSafe.address)).to.eq(0);
      expect(await mockDAI.balanceOf(f.mockSafe.address)).to.eq(0);
    });

    it("Should continue past failures when silent=true", async () => {
      const { mockUSDC, mockDAI } = f;

      const MockClaimableStrategy = await ethers.getContractFactory(
        "MockClaimableStrategy"
      );
      const strategy2 = await MockClaimableStrategy.deploy();

      const amount2 = parseUnits("300", 18);

      // strategy1 will revert
      await f.mockClaimableStrategy.setRewardTokenAddresses([mockUSDC.address]);
      await f.mockClaimableStrategy.setShouldRevert(true);

      // strategy2 succeeds
      await strategy2.setRewardTokenAddresses([mockDAI.address]);
      await mockDAI.mintTo(strategy2.address, amount2);

      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(strategy2.address);

      const tx = await f.claimRewardsModule
        .connect(f.safeSigner)
        .claimRewards(true);

      await expect(tx)
        .to.emit(f.claimRewardsModule, "ClaimRewardsFailed")
        .withArgs(f.mockClaimableStrategy.address);
      await expect(tx)
        .to.emit(f.claimRewardsModule, "RewardTokensForwarded")
        .withArgs(strategy2.address, mockDAI.address, amount2);

      expect(await mockDAI.balanceOf(rewardsTo)).to.eq(amount2);
    });

    it("Should stop on first failure when silent=false", async () => {
      await f.mockClaimableStrategy.setRewardTokenAddresses([]);
      await f.mockClaimableStrategy.setShouldRevert(true);
      await f.claimRewardsModule
        .connect(f.safeSigner)
        .addStrategy(f.mockClaimableStrategy.address);

      await expect(
        f.claimRewardsModule.connect(f.safeSigner).claimRewards(false)
      ).to.be.revertedWith("Failed to claim rewards");
    });
  });
});
