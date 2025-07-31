const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { units, isCI } = require("../helpers");

const { createFixtureLoader, makerSSRFixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:ousd:makerSSR");

describe("ForkTest: Maker SSR Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(makerSSRFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { vault, makerSSRStrategy } = fixture;

      expect(await makerSSRStrategy.platformAddress()).to.equal(
        addresses.mainnet.sUSDS
      );
      expect(await makerSSRStrategy.vaultAddress()).to.equal(vault.address);
      expect(await makerSSRStrategy.shareToken()).to.equal(
        addresses.mainnet.sUSDS
      );
      expect(await makerSSRStrategy.assetToken()).to.equal(
        addresses.mainnet.USDS
      );
      expect(
        await makerSSRStrategy.supportsAsset(addresses.mainnet.USDS)
      ).to.equal(true);
      expect(
        await makerSSRStrategy.assetToPToken(addresses.mainnet.USDS)
      ).to.equal(addresses.mainnet.sUSDS);
      expect(await makerSSRStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
    });
    it("Should be able to check balance", async () => {
      const { usds, josh, makerSSRStrategy } = fixture;

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await makerSSRStrategy
        .connect(josh)
        .populateTransaction.checkBalance(usds.address);
      await josh.sendTransaction(tx);
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        timelock,
        oldTimelock,
        strategist,
        josh,
        daniel,
        domen,
        vaultSigner,
        makerSSRStrategy,
        usds,
        sUSDS,
      } = fixture;

      // Governor can approve all tokens
      const tx = await makerSSRStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.not.emit(sUSDS, "Approval");
      await expect(tx).to.emit(usds, "Approval");

      for (const signer of [
        daniel,
        domen,
        josh,
        strategist,
        oldTimelock,
        vaultSigner,
      ]) {
        const tx = makerSSRStrategy.connect(signer).safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some USDS in the vault", () => {
    const loadFixture = createFixtureLoader(makerSSRFixture, {
      usdsMintAmount: 12000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit some USDS to strategy", async function () {
      const {
        usds,
        ousd,
        sUSDS,
        makerSSRStrategy,
        vault,
        strategist,
        vaultSigner,
      } = fixture;

      const usdsDepositAmount = await units("1000", usds);

      // Vault transfers USDS to strategy
      await usds
        .connect(vaultSigner)
        .transfer(makerSSRStrategy.address, usdsDepositAmount);

      await vault.connect(strategist).rebase();

      const ousdSupplyBefore = await ousd.totalSupply();

      log(
        `Before depositing ${formatUnits(
          usdsDepositAmount
        )} USDS to Maker SSR Strategy`
      );

      const tx = await makerSSRStrategy
        .connect(vaultSigner)
        .deposit(usds.address, usdsDepositAmount);

      log(`After depositing USDS to Maker SSR Strategy`);

      // Check emitted event
      await expect(tx)
        .to.emit(makerSSRStrategy, "Deposit")
        .withArgs(usds.address, sUSDS.address, usdsDepositAmount);

      // Check the OUSD total supply increase
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore.add(usdsDepositAmount),
        0.1 // 0.1% or 10 basis point
      );
    });
    it("Only vault can deposit some USDS to the strategy", async function () {
      const {
        usds,
        makerSSRStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usds);
      await usds
        .connect(vaultSigner)
        .transfer(makerSSRStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = makerSSRStrategy
          .connect(signer)
          .deposit(usds.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all USDS to strategy", async function () {
      const {
        usds,
        makerSSRStrategy,
        vaultSigner,
        strategist,
        oldTimelock,
        timelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usds);
      await usds
        .connect(vaultSigner)
        .transfer(makerSSRStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = makerSSRStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await makerSSRStrategy.connect(vaultSigner).depositAll();
      await expect(tx).to.emit(makerSSRStrategy, "Deposit");
    });
  });

  describe("with the strategy having some USDS in Maker SSR Strategy", () => {
    const loadFixture = createFixtureLoader(makerSSRFixture, {
      usdsMintAmount: 12000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should be able to withdraw all", async () => {
      const { usds, sUSDS, makerSSRStrategy, ousd, vault, vaultSigner } =
        fixture;

      const usdsWithdrawAmountExpected = await sUSDS.maxWithdraw(
        makerSSRStrategy.address
      );
      log(
        `Expected to withdraw ${formatUnits(usdsWithdrawAmountExpected)} USDS`
      );

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUsdsBalanceBefore = await usds.balanceOf(vault.address);

      log("Before withdraw all from strategy");

      // Now try to withdraw all the WETH from the strategy
      const tx = await makerSSRStrategy.connect(vaultSigner).withdrawAll();

      log("After withdraw all from strategy");

      // Check emitted event
      await expect(tx).to.emittedEvent("Withdrawal", [
        usds.address,
        sUSDS.address,
        (amount) =>
          expect(amount).approxEqualTolerance(
            usdsWithdrawAmountExpected,
            0.01,
            "Withdrawal amount"
          ),
      ]);

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "Withdrawal");
      log(`Actual withdrawal amount: ${formatUnits(event.args[2])}`);
      expect(event.args[2]).to.approxEqualTolerance(
        usdsWithdrawAmountExpected,
        0.01
      );

      // Check the OUSD total supply stays the same
      expect(await ousd.totalSupply()).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDS amount in the vault increases
      expect(await usds.balanceOf(vault.address)).to.approxEqualTolerance(
        vaultUsdsBalanceBefore.add(usdsWithdrawAmountExpected),
        0.01
      );
    });
    it("Vault should be able to withdraw some USDS", async () => {
      const { usds, sUSDS, makerSSRStrategy, ousd, vault, vaultSigner } =
        fixture;

      const withdrawAmount = await units("1000", usds);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUsdsBalanceBefore = await usds.balanceOf(vault.address);

      log(`Before withdraw of ${formatUnits(withdrawAmount)} from strategy`);

      // Now try to withdraw the USDS from the strategy
      const tx = await makerSSRStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, usds.address, withdrawAmount);

      log("After withdraw from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(makerSSRStrategy, "Withdrawal")
        .withArgs(usds.address, sUSDS.address, withdrawAmount);

      // Check the OUSD total supply stays the same
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDS balance in the Vault
      expect(await usds.balanceOf(vault.address)).to.equal(
        vaultUsdsBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some USDS from AMO strategy", async function () {
      const {
        makerSSRStrategy,
        oethVault,
        strategist,
        timelock,
        oldTimelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, oldTimelock, josh]) {
        const tx = makerSSRStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all USDS from Maker SSR strategy", async function () {
      const { makerSSRStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = makerSSRStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = makerSSRStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(makerSSRStrategy, "Withdrawal");
    });
  });

  describe("administration", () => {
    const loadFixture = createFixtureLoader(makerSSRFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Governor should not be able to set the platform token", () => {
      const { frxETH, sfrxETH, makerSSRStrategy, timelock } = fixture;

      const tx = makerSSRStrategy
        .connect(timelock)
        .setPTokenAddress(frxETH.address, sfrxETH.address);
      expect(tx).to.be.revertedWith("unsupported function");
    });
    it("Governor should not be able to remove the platform token", () => {
      const { makerSSRStrategy, timelock } = fixture;

      const tx = makerSSRStrategy.connect(timelock).removePToken(0);
      expect(tx).to.be.revertedWith("unsupported function");
    });
  });
});
