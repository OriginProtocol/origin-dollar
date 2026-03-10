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

  // ─────────────────────────── processWithdrawals — access control ──

  describe("processWithdrawals() - access control", () => {
    it("Should revert if called by a non-operator", async () => {
      const { rebalancerModule, mockStrategy, stranger } = f;
      await expect(
        rebalancerModule
          .connect(stranger)
          .processWithdrawals([mockStrategy.address], [ousdUnits("100")])
      ).to.be.revertedWith("Caller is not an operator");
    });

    it("Should revert when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setPaused(true);
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawals([mockStrategy.address], [ousdUnits("100")])
      ).to.be.revertedWith("Module is paused");
    });

    it("Should revert on array length mismatch", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawals(
            [mockStrategy.address],
            [ousdUnits("100"), ousdUnits("200")]
          )
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  // ─────────────────────────── processWithdrawals — functionality ──

  describe("processWithdrawals() - single strategy", () => {
    it("Should withdraw from a single strategy", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals([mockStrategy.address], [ousdUnits("600")]);

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

  describe("processWithdrawals() - multiple strategies", () => {
    it("Should withdraw from two strategies in one call", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      // Deploy a second mock strategy
      const MockStrategy = await ethers.getContractFactory("MockStrategy");
      const mockStrategy2 = await MockStrategy.deploy();
      await mockStrategy2.deployed();

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("0")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals(
          [mockStrategy.address, mockStrategy2.address],
          [ousdUnits("400"), ousdUnits("300")]
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

  describe("processWithdrawals() - skips zero amounts", () => {
    it("Should skip strategies with amount 0", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals([mockStrategy.address], [0]);

      // No MockedWithdrawal emitted since amount was 0
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
      // But WithdrawalsProcessed is always emitted
      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
    });
  });

  describe("processWithdrawals() - Safe exec failure", () => {
    it("Should emit WithdrawalFailed and continue when vault reverts", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );
      await mockVault.revertNextWithdraw();

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals([mockStrategy.address], [ousdUnits("600")]);

      await expect(tx)
        .to.emit(rebalancerModule, "WithdrawalFailed")
        .withArgs(mockStrategy.address, ousdUnits("600"));

      // WithdrawalsProcessed should still be emitted
      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
      // No MockedWithdrawal emitted (the call reverted)
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
    });
  });

  describe("processWithdrawals() - empty arrays", () => {
    it("Should handle empty arrays gracefully", async () => {
      const { rebalancerModule, mockVault, safeSigner } = f;

      await mockVault.setWithdrawalQueueMetadata(
        ousdUnits("1000"),
        ousdUnits("400")
      );

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals([], []);

      await expect(tx).to.emit(rebalancerModule, "WithdrawalsProcessed");
      await expect(tx).to.not.emit(mockVault, "MockedWithdrawal");
    });
  });

  // ─────────────────────────── processDeposits — access control ──

  describe("processDeposits() - access control", () => {
    it("Should revert if called by a non-operator", async () => {
      const { rebalancerModule, mockStrategy, stranger } = f;
      await expect(
        rebalancerModule
          .connect(stranger)
          .processDeposits([mockStrategy.address], [ousdUnits("100")])
      ).to.be.revertedWith("Caller is not an operator");
    });

    it("Should revert when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await rebalancerModule.connect(safeSigner).setPaused(true);
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processDeposits([mockStrategy.address], [ousdUnits("100")])
      ).to.be.revertedWith("Module is paused");
    });

    it("Should revert on array length mismatch", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;
      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processDeposits(
            [mockStrategy.address],
            [ousdUnits("100"), ousdUnits("200")]
          )
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  // ─────────────────────────── processDeposits — functionality ──

  describe("processDeposits() - single strategy", () => {
    it("Should deposit to a single strategy", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processDeposits([mockStrategy.address], [ousdUnits("500")]);

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

  describe("processDeposits() - multiple strategies", () => {
    it("Should deposit to two strategies in one call", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const MockStrategy = await ethers.getContractFactory("MockStrategy");
      const mockStrategy2 = await MockStrategy.deploy();
      await mockStrategy2.deployed();

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processDeposits(
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

  describe("processDeposits() - skips zero amounts", () => {
    it("Should skip strategies with amount 0", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processDeposits([mockStrategy.address], [0]);

      await expect(tx).to.not.emit(mockVault, "MockedDeposit");
      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
    });
  });

  describe("processDeposits() - Safe exec failure", () => {
    it("Should emit DepositFailed and continue when vault reverts", async () => {
      const { rebalancerModule, mockVault, mockStrategy, safeSigner } = f;

      await mockVault.revertNextDeposit();

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processDeposits([mockStrategy.address], [ousdUnits("500")]);

      await expect(tx)
        .to.emit(rebalancerModule, "DepositFailed")
        .withArgs(mockStrategy.address, ousdUnits("500"));

      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
      await expect(tx).to.not.emit(mockVault, "MockedDeposit");
    });
  });

  describe("processDeposits() - empty arrays", () => {
    it("Should handle empty arrays gracefully", async () => {
      const { rebalancerModule, safeSigner } = f;

      const tx = await rebalancerModule
        .connect(safeSigner)
        .processDeposits([], []);

      await expect(tx).to.emit(rebalancerModule, "DepositsProcessed");
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

    it("Should block processWithdrawals when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;

      await rebalancerModule.connect(safeSigner).setPaused(true);

      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processWithdrawals([mockStrategy.address], [ousdUnits("100")])
      ).to.be.revertedWith("Module is paused");
    });

    it("Should block processDeposits when paused", async () => {
      const { rebalancerModule, mockStrategy, safeSigner } = f;

      await rebalancerModule.connect(safeSigner).setPaused(true);

      await expect(
        rebalancerModule
          .connect(safeSigner)
          .processDeposits([mockStrategy.address], [ousdUnits("100")])
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

      // Should not revert
      const tx = await rebalancerModule
        .connect(safeSigner)
        .processWithdrawals([mockStrategy.address], [ousdUnits("600")]);

      await expect(tx).to.emit(mockVault, "MockedWithdrawal");
    });
  });
});
