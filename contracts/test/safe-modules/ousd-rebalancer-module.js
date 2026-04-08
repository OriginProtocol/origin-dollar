const { expect } = require("chai");
const { createFixtureLoader, rebalancerModuleFixture } = require("../_fixture");
const { ousdUnits } = require("../helpers");

const fixture = createFixtureLoader(rebalancerModuleFixture);

describe("Unit Test: OUSD Rebalancer Safe Module", function () {
  let f;

  beforeEach(async () => {
    f = await fixture();
  });

  describe("Deployment / Immutables", () => {
    it("Should set vault to MockVault", async () => {
      const { rebalancerModule, mockVault } = f;
      expect(await rebalancerModule.vault()).to.eq(mockVault.address);
    });

    it("Should set asset to MockVault's asset", async () => {
      const { rebalancerModule, mockVault } = f;
      expect(await rebalancerModule.asset()).to.eq(await mockVault.asset());
    });

    it("Should set safeContract to MockSafeContract", async () => {
      const { rebalancerModule, mockSafe } = f;
      expect(await rebalancerModule.safeContract()).to.eq(mockSafe.address);
    });

    it("Should not be paused initially", async () => {
      const { rebalancerModule } = f;
      expect(await rebalancerModule.paused()).to.eq(false);
    });
  });

  describe("pendingShortfall()", () => {
    it("Should return queued minus claimable", async () => {
      const { rebalancerModule, mockVault } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );
      expect(await rebalancerModule.pendingShortfall()).to.eq(ousdUnits("600"));
    });

    it("Should return 0 when queue is fully funded", async () => {
      const { rebalancerModule, mockVault } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("1000")
      );
      expect(await rebalancerModule.pendingShortfall()).to.eq(0);
    });
  });

  // ─────────────────────── processWithdrawalsAndDeposits — access control ──

  describe("processWithdrawalsAndDeposits() - access control", () => {
    it("Should revert if called by a non-operator", async () => {
      const { rebalancerModule, mockStrategy, stranger } = f;
      await expect(
        rebalancerModule
          .connect(stranger)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("100")],
            [],
            []
          )
      ).to.be.revertedWith("Caller is not an operator");
    });

    it("Should revert when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setPaused(true);
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("100")],
            [],
            []
          )
      ).to.be.revertedWith("Module is paused");
    });

    it("Should revert on withdraw array length mismatch", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("100"), ousdUnits("200")],
            [],
            []
          )
      ).to.be.revertedWith("Withdraw array length mismatch");
    });

    it("Should revert on deposit array length mismatch", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [],
            [],
            [mockStrategy.address],
            [ousdUnits("100"), ousdUnits("200")]
          )
      ).to.be.revertedWith("Deposit array length mismatch");
    });
  });

  // ────────────────────────── withdrawals — functionality ──

  describe("processWithdrawalsAndDeposits() - single withdrawal", () => {
    it("Should withdraw from a single strategy", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("600")],
          [],
          []
        );

      await expect(tx)
        .to.emit(mockVault, "MockedWithdrawal")
        .withArgs(
          mockStrategy.address,
          await rebalancerModule.asset(),
          ousdUnits("600")
        );

      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
    });
  });

  describe("processWithdrawalsAndDeposits() - multiple withdrawals", () => {
    it("Should withdraw from two strategies in one call", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const MockStrategy = await ethers.getContractFactory("MockStrategy");
      const mockStrategy2 = await MockStrategy.deploy();
      await mockStrategy2.deployed();
      await rebalancerModule
        .connect(safeSigner)
        .allowStrategy(mockStrategy2.address);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("0")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address, mockStrategy2.address],
          [ousdUnits("400"), ousdUnits("300")],
          [],
          []
        );

      const asset = await rebalancerModule.asset();
      await expect(tx)
        .to.emit(mockVault, "MockedWithdrawal")
        .withArgs(mockStrategy.address, asset, ousdUnits("400"));
      await expect(tx)
        .to.emit(mockVault, "MockedWithdrawal")
        .withArgs(mockStrategy2.address, asset, ousdUnits("300"));
    });
  });

  describe("processWithdrawalsAndDeposits() - skips zero withdrawal amounts", () => {
    it("Should skip strategies with amount 0", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits([mockStrategy.address], [0], [], []);

      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
    });
  });

  describe("processWithdrawalsAndDeposits() - withdrawal Safe exec failure", () => {
    it("Should emit WithdrawalFailed and continue when vault reverts", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );
      await mockVault.revertNextWithdraw();

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("600")],
          [],
          []
        );

      await expect(tx)
        .to.emit(rebalancerModule, "WithdrawalFailed")
        .withArgs(mockStrategy.address, ousdUnits("600"));

      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
    });
  });

  // ────────────────────────── deposits — functionality ──

  describe("processWithdrawalsAndDeposits() - single deposit", () => {
    it("Should deposit to a single strategy", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [],
          [],
          [mockStrategy.address],
          [ousdUnits("500")]
        );

      await expect(tx)
        .to.emit(mockVault, "MockedDeposit")
        .withArgs(
          mockStrategy.address,
          await rebalancerModule.asset(),
          ousdUnits("500")
        );

      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
    });
  });

  describe("processWithdrawalsAndDeposits() - multiple deposits", () => {
    it("Should deposit to two strategies in one call", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const MockStrategy = await ethers.getContractFactory("MockStrategy");
      const mockStrategy2 = await MockStrategy.deploy();
      await mockStrategy2.deployed();
      await rebalancerModule
        .connect(safeSigner)
        .allowStrategy(mockStrategy2.address);

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [],
          [],
          [mockStrategy.address, mockStrategy2.address],
          [ousdUnits("300"), ousdUnits("200")]
        );

      const asset = await rebalancerModule.asset();
      await expect(tx)
        .to.emit(mockVault, "MockedDeposit")
        .withArgs(mockStrategy.address, asset, ousdUnits("300"));
      await expect(tx)
        .to.emit(mockVault, "MockedDeposit")
        .withArgs(mockStrategy2.address, asset, ousdUnits("200"));
    });
  });

  describe("processWithdrawalsAndDeposits() - skips zero deposit amounts", () => {
    it("Should skip strategies with amount 0", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits([], [], [mockStrategy.address], [0]);

      await expect(tx).to.not.emit(mockVault, "MockedDeposit");
      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
    });
  });

  describe("processWithdrawalsAndDeposits() - deposit Safe exec failure", () => {
    it("Should emit DepositFailed and continue when vault reverts", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.revertNextDeposit();

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [],
          [],
          [mockStrategy.address],
          [ousdUnits("500")]
        );

      await expect(tx)
        .to.emit(rebalancerModule, "DepositFailed")
        .withArgs(mockStrategy.address, ousdUnits("500"));

      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
      await expect(tx).to.not.emit(mockVault, "MockedDeposit");
    });
  });

  describe("processWithdrawalsAndDeposits() - empty arrays", () => {
    it("Should handle all-empty arrays gracefully", async () => {
      const { rebalancerModule, mockVault, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits([], [], [], []);

      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
      await expect(tx).to.not.emit(mockVault, "MockedDeposit");
    });
  });

  // ─────────────────────────── setPaused ──

  describe("setPaused()", () => {
    it("Should revert if called by a non-safe address", async () => {
      const { rebalancerModule, stranger } = f;
      await expect(
        rebalancerModule.connect(stranger).setPaused(true)
      ).to.be.revertedWith("Caller is not the safe contract");
    });

    it("Should pause the module", async () => {
      const { rebalancerModule, safeSigner } = f;

      await expect(rebalancerModule.connect(safeSigner).setPaused(true))
        .to.emit(rebalancerModule, "PausedStateChanged")
        .withArgs(true);

      expect(await rebalancerModule.paused()).to.eq(true);
    });

    it("Should unpause the module", async () => {
      const { rebalancerModule, safeSigner } = f;

      await rebalancerModule.connect(safeSigner).setPaused(true);

      await expect(rebalancerModule.connect(safeSigner).setPaused(false))
        .to.emit(rebalancerModule, "PausedStateChanged")
        .withArgs(false);

      expect(await rebalancerModule.paused()).to.eq(false);
    });

    it("Should block processWithdrawalsAndDeposits when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;

      await rebalancerModule.connect(safeSigner).setPaused(true);

      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("100")],
            [],
            []
          )
      ).to.be.revertedWith("Module is paused");
    });

    it("Should allow operations after unpause", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await rebalancerModule.connect(safeSigner).setPaused(true);
      await rebalancerModule.connect(safeSigner).setPaused(false);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("600")],
          [],
          []
        );

      await expect(tx).to.emit(mockVault, "MockedWithdrawal");
    });
  });

  describe("Strategy whitelist", () => {
    it("Should start with mockStrategy allowed (set in fixture)", async () => {
      const { rebalancerModule, mockStrategy } = f;
      expect(await rebalancerModule.isAllowedStrategy(mockStrategy.address)).to
        .be.true;
    });

    it("Should let the Safe allow a new strategy", async () => {
      const { rebalancerModule, safeSigner } = f;
      const newStrategy = "0x0000000000000000000000000000000000000099";
      const tx = await rebalancerModule
        .connect(safeSigner)
        .allowStrategy(newStrategy);
      await expect(tx)
        .to.emit(rebalancerModule, "StrategyAllowed")
        .withArgs(newStrategy);
      expect(await rebalancerModule.isAllowedStrategy(newStrategy)).to.be.true;
    });

    it("Should let the Safe revoke a strategy", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      const tx = await rebalancerModule
        .connect(safeSigner)
        .revokeStrategy(mockStrategy.address);
      await expect(tx)
        .to.emit(rebalancerModule, "StrategyRevoked")
        .withArgs(mockStrategy.address);
      expect(await rebalancerModule.isAllowedStrategy(mockStrategy.address)).to
        .be.false;
    });

    it("Should revert allowStrategy when called by non-Safe", async () => {
      const { rebalancerModule, stranger } = f;
      await expect(
        rebalancerModule
          .connect(stranger)
          .allowStrategy("0x0000000000000000000000000000000000000099")
      ).to.be.revertedWith("Caller is not the safe contract");
    });

    it("Should revert revokeStrategy when called by non-Safe", async () => {
      const { rebalancerModule, mockStrategy, stranger } = f;
      await expect(
        rebalancerModule.connect(stranger).revokeStrategy(mockStrategy.address)
      ).to.be.revertedWith("Caller is not the safe contract");
    });

    it("Should revert processWithdrawalsAndDeposits for a non-whitelisted withdrawal strategy", async () => {
      const { rebalancerModule, safeSigner } = f;
      const nonWhitelisted = "0x0000000000000000000000000000000000000099";
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [nonWhitelisted],
            [ousdUnits("100")],
            [],
            []
          )
      ).to.be.revertedWith("Strategy not allowed");
    });

    it("Should revert processWithdrawalsAndDeposits for a non-whitelisted deposit strategy", async () => {
      const { rebalancerModule, safeSigner } = f;
      const nonWhitelisted = "0x0000000000000000000000000000000000000099";
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [],
            [],
            [nonWhitelisted],
            [ousdUnits("100")]
          )
      ).to.be.revertedWith("Strategy not allowed");
    });

    it("Should revert processWithdrawalsAndDeposits after strategy is revoked", async () => {
      const { rebalancerModule, mockStrategy, mockVault, safeSigner } = f;
      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );
      await rebalancerModule
        .connect(safeSigner)
        .revokeStrategy(mockStrategy.address);
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("600")],
            [],
            []
          )
      ).to.be.revertedWith("Strategy not allowed");
    });
  });

  // ─────────────────────────── Daily movement limit ──

  describe("Daily movement limit", () => {
    it("Should set maxDailyMovementBps to 20000 (200%) by default", async () => {
      const { rebalancerModule } = f;
      expect(await rebalancerModule.maxDailyMovementBps()).to.eq(20000);
    });

    it("Should revert setMaxDailyMovementBps when called by non-Safe", async () => {
      const { rebalancerModule, stranger } = f;
      await expect(
        rebalancerModule.connect(stranger).setMaxDailyMovementBps(10000)
      ).to.be.revertedWith("Caller is not the safe contract");
    });

    it("Should update maxDailyMovementBps and emit event", async () => {
      const { rebalancerModule, safeSigner } = f;
      const tx = await rebalancerModule
        .connect(safeSigner)
        .setMaxDailyMovementBps(5000);
      await expect(tx)
        .to.emit(rebalancerModule, "MaxDailyMovementBpsSet")
        .withArgs(5000);
      expect(await rebalancerModule.maxDailyMovementBps()).to.eq(5000);
    });

    it("Should revert withdrawal when daily limit is exceeded", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;
      // TVL = $10M, limit = 200% = $20M
      // Set limit to 1% = $100K
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(100);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000000"),
        ousdUnits("0")
      );

      await expect(
        rebalancerModule.connect(safeSigner).processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("200000")], // $200K > $100K limit
          [],
          []
        )
      ).to.be.revertedWith("Daily movement limit exceeded");
    });

    it("Should revert deposit when daily limit is exceeded", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(100); // 1% = $100K

      await expect(
        rebalancerModule.connect(safeSigner).processWithdrawalsAndDeposits(
          [],
          [],
          [mockStrategy.address],
          [ousdUnits("200000")] // $200K > $100K limit
        )
      ).to.be.revertedWith("Daily movement limit exceeded");
    });

    it("Should accumulate movements across multiple calls", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;
      // TVL = $10M, set limit to 1% = $100K
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(100);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000000"),
        ousdUnits("0")
      );

      // First call: $60K — should succeed
      await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("60000")],
          [],
          []
        );

      // Second call: $60K — total $120K > $100K limit — should revert
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("60000")],
            [],
            []
          )
      ).to.be.revertedWith("Daily movement limit exceeded");
    });

    it("Should return correct dailyLimit based on TVL and bps", async () => {
      const { rebalancerModule, mockVault } = f;
      // TVL = $10M, default 200% = $20M limit
      expect(await rebalancerModule.dailyLimit()).to.eq(ousdUnits("20000000"));

      // Change TVL to $5M
      await mockVault.setTotalValue(ousdUnits("5000000"));
      expect(await rebalancerModule.dailyLimit()).to.eq(ousdUnits("10000000"));
    });

    it("Should return correct remainingDailyLimit after movements", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;
      // TVL = $10M, limit 1% = $100K
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(100);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000000"),
        ousdUnits("0")
      );

      // Before any movement: full limit available
      expect(await rebalancerModule.remainingDailyLimit()).to.eq(
        ousdUnits("100000")
      );

      // Move $60K
      await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("60000")],
          [],
          []
        );

      // $40K remaining
      expect(await rebalancerModule.remainingDailyLimit()).to.eq(
        ousdUnits("40000")
      );
    });

    it("Should return 0 remainingDailyLimit when fully used", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(100); // 1% = $100K

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000000"),
        ousdUnits("0")
      );

      await rebalancerModule
        .connect(safeSigner)
        .processWithdrawalsAndDeposits(
          [mockStrategy.address],
          [ousdUnits("100000")],
          [],
          []
        );

      expect(await rebalancerModule.remainingDailyLimit()).to.eq(0);
    });

    it("Should block all movements when maxDailyMovementBps is 0", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setMaxDailyMovementBps(0);

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("0")
      );

      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawalsAndDeposits(
            [mockStrategy.address],
            [ousdUnits("1")],
            [],
            []
          )
      ).to.be.revertedWith("Daily movement limit exceeded");
    });
  });
});
