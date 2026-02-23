const { expect } = require("chai");
const {
  createFixtureLoader,
  autoWithdrawalModuleFixture,
} = require("../_fixture");
const addresses = require("../../utils/addresses");
const { ousdUnits } = require("../helpers");

const fixture = createFixtureLoader(autoWithdrawalModuleFixture);

describe("Unit Test: OUSD Auto-Withdrawal Safe Module", function () {
  let f;

  beforeEach(async () => {
    f = await fixture();
  });

  describe("Deployment / Immutables", () => {
    it("Should set vault to MockVault", async () => {
      const { autoWithdrawalModule, mockVault } = f;
      expect(await autoWithdrawalModule.vault()).to.eq(mockVault.address);
    });

    it("Should set asset to MockVault's asset", async () => {
      const { autoWithdrawalModule, mockVault } = f;
      expect(await autoWithdrawalModule.asset()).to.eq(
        await mockVault.asset()
      );
    });

    it("Should set strategy to addresses.dead", async () => {
      const { autoWithdrawalModule } = f;
      expect(await autoWithdrawalModule.strategy()).to.eq(addresses.dead);
    });

    it("Should set safeContract to MockSafeContract", async () => {
      const { autoWithdrawalModule, mockSafe } = f;
      expect(await autoWithdrawalModule.safeContract()).to.eq(mockSafe.address);
    });
  });

  describe("pendingShortfall()", () => {
    it("Should return queued minus claimable", async () => {
      const { autoWithdrawalModule, mockVault } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );
      expect(await autoWithdrawalModule.pendingShortfall()).to.eq(
        ousdUnits("600")
      );
    });

    it("Should return 0 when queue is fully funded", async () => {
      const { autoWithdrawalModule, mockVault } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("1000")
      );
      expect(await autoWithdrawalModule.pendingShortfall()).to.eq(0);
    });
  });

  describe("fundWithdrawals() - access control", () => {
    it("Should revert if called by a non-operator", async () => {
      const { autoWithdrawalModule, stranger } = f;
      await expect(
        autoWithdrawalModule.connect(stranger).fundWithdrawals()
      ).to.be.revertedWith("Caller is not an operator");
    });
  });

  describe("fundWithdrawals() - queue already satisfied", () => {
    it("Should do nothing when shortfall is 0", async () => {
      const { autoWithdrawalModule, mockVault, safeSigner } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("1000")
      );
      const tx = await autoWithdrawalModule
        .connect(safeSigner)
        .fundWithdrawals();
      await expect(tx).to.not.emit(autoWithdrawalModule, "LiquidityWithdrawn");
      await expect(tx).to.not.emit(
        autoWithdrawalModule,
        "InsufficientStrategyLiquidity"
      );
      await expect(tx).to.not.emit(autoWithdrawalModule, "WithdrawalFailed");
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
    });
  });

  describe("fundWithdrawals() - strategy has zero balance", () => {
    it("Should emit InsufficientStrategyLiquidity when strategy balance is 0", async () => {
      const { autoWithdrawalModule, mockVault, mockStrategy, safeSigner } = f;

      // Switch to a real strategy contract (addresses.dead has no code)
      await autoWithdrawalModule
        .connect(safeSigner)
        .setStrategy(mockStrategy.address);

      // Leave setNextBalance at 0 (default) so checkBalance returns 0
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      await expect(
        autoWithdrawalModule.connect(safeSigner).fundWithdrawals()
      )
        .to.emit(autoWithdrawalModule, "InsufficientStrategyLiquidity")
        .withArgs(mockStrategy.address, ousdUnits("600"), 0);
    });
  });

  describe("fundWithdrawals() - shortfall fully covered", () => {
    it("Should withdraw exact shortfall when strategy has enough", async () => {
      const { autoWithdrawalModule, mockVault, mockStrategy, safeSigner } = f;

      await autoWithdrawalModule
        .connect(safeSigner)
        .setStrategy(mockStrategy.address);

      await mockStrategy.setNextBalance(ousdUnits("1000"));
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await autoWithdrawalModule
        .connect(safeSigner)
        .fundWithdrawals();

      await expect(tx)
        .to.emit(autoWithdrawalModule, "LiquidityWithdrawn")
        .withArgs(mockStrategy.address, ousdUnits("600"), 0);

      await expect(tx)
        .to.emit(mockVault, "MockedWithdrawal")
        .withArgs(mockStrategy.address, await autoWithdrawalModule.asset(), ousdUnits("600"));
    });
  });

  describe("fundWithdrawals() - shortfall partially covered", () => {
    it("Should withdraw only what strategy has when balance < shortfall", async () => {
      const { autoWithdrawalModule, mockVault, mockStrategy, safeSigner } = f;

      await autoWithdrawalModule
        .connect(safeSigner)
        .setStrategy(mockStrategy.address);

      await mockStrategy.setNextBalance(ousdUnits("200"));
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await autoWithdrawalModule
        .connect(safeSigner)
        .fundWithdrawals();

      await expect(tx)
        .to.emit(autoWithdrawalModule, "LiquidityWithdrawn")
        .withArgs(mockStrategy.address, ousdUnits("200"), ousdUnits("400"));

      await expect(tx)
        .to.emit(mockVault, "MockedWithdrawal")
        .withArgs(mockStrategy.address, await autoWithdrawalModule.asset(), ousdUnits("200"));
    });
  });

  describe("fundWithdrawals() - Safe exec fails", () => {
    it("Should emit WithdrawalFailed when vault reverts", async () => {
      const { autoWithdrawalModule, mockVault, mockStrategy, safeSigner } = f;

      await autoWithdrawalModule
        .connect(safeSigner)
        .setStrategy(mockStrategy.address);

      await mockStrategy.setNextBalance(ousdUnits("1000"));
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      // Arm the vault to revert on the next withdrawal
      await mockVault.revertNextWithdraw();

      const tx = await autoWithdrawalModule
        .connect(safeSigner)
        .fundWithdrawals();

      await expect(tx)
        .to.emit(autoWithdrawalModule, "WithdrawalFailed")
        .withArgs(mockStrategy.address, ousdUnits("600"));

      await expect(tx).to.not.emit(autoWithdrawalModule, "LiquidityWithdrawn");
    });
  });

  describe("setStrategy()", () => {
    it("Should revert if called by a non-safe address", async () => {
      const { autoWithdrawalModule, mockStrategy, stranger } = f;
      await expect(
        autoWithdrawalModule
          .connect(stranger)
          .setStrategy(mockStrategy.address)
      ).to.be.revertedWith("Caller is not the safe contract");
    });

    it("Should update strategy and emit StrategyUpdated", async () => {
      const { autoWithdrawalModule, mockStrategy, safeSigner } = f;
      const oldStrategy = await autoWithdrawalModule.strategy();

      await expect(
        autoWithdrawalModule
          .connect(safeSigner)
          .setStrategy(mockStrategy.address)
      )
        .to.emit(autoWithdrawalModule, "StrategyUpdated")
        .withArgs(oldStrategy, mockStrategy.address);

      expect(await autoWithdrawalModule.strategy()).to.eq(
        mockStrategy.address
      );
    });

    it("Should revert on zero address", async () => {
      const { autoWithdrawalModule, safeSigner } = f;
      await expect(
        autoWithdrawalModule
          .connect(safeSigner)
          .setStrategy(addresses.zero)
      ).to.be.revertedWith("Invalid strategy");
    });
  });
});
