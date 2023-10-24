const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { units, isCI } = require("../helpers");

const { createFixtureLoader, makerDsrFixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:ousd:makerDSR");

describe("ForkTest: Maker DSR Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(makerDsrFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { vault, makerDsrStrategy } = fixture;

      expect(await makerDsrStrategy.platformAddress()).to.equal(
        addresses.mainnet.sDAI
      );
      expect(await makerDsrStrategy.vaultAddress()).to.equal(vault.address);
      expect(await makerDsrStrategy.shareToken()).to.equal(
        addresses.mainnet.sDAI
      );
      expect(await makerDsrStrategy.assetToken()).to.equal(
        addresses.mainnet.DAI
      );
      expect(
        await makerDsrStrategy.supportsAsset(addresses.mainnet.DAI)
      ).to.equal(true);
      expect(
        await makerDsrStrategy.assetToPToken(addresses.mainnet.DAI)
      ).to.equal(addresses.mainnet.sDAI);
      expect(await makerDsrStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
    });
    it("Should be able to check balance", async () => {
      const { dai, josh, makerDsrStrategy } = fixture;

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await makerDsrStrategy
        .connect(josh)
        .populateTransaction.checkBalance(dai.address);
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
        makerDsrStrategy,
        dai,
        sDAI,
      } = fixture;

      // Governor can approve all tokens
      const tx = await makerDsrStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.not.emit(sDAI, "Approval");
      await expect(tx).to.emit(dai, "Approval");

      for (const signer of [
        daniel,
        domen,
        josh,
        strategist,
        oldTimelock,
        vaultSigner,
      ]) {
        const tx = makerDsrStrategy.connect(signer).safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some DAI in the vault", () => {
    const loadFixture = createFixtureLoader(makerDsrFixture, {
      daiMintAmount: 12000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit some DAI to strategy", async function () {
      const { dai, ousd, sDAI, makerDsrStrategy, vaultSigner } = fixture;

      const daiDepositAmount = await units("1000", dai);

      // Vault transfers DAI to strategy
      await dai
        .connect(vaultSigner)
        .transfer(makerDsrStrategy.address, daiDepositAmount);

      const ousdSupplyBefore = await ousd.totalSupply();

      log(
        `Before depositing ${formatUnits(
          daiDepositAmount
        )} DAI to Maker DSR Strategy`
      );

      const tx = await makerDsrStrategy
        .connect(vaultSigner)
        .deposit(dai.address, daiDepositAmount);

      log(`After depositing DAI to Maker DSR Strategy`);

      // Check emitted event
      await expect(tx)
        .to.emit(makerDsrStrategy, "Deposit")
        .withArgs(dai.address, sDAI.address, daiDepositAmount);

      // Check the OUSD total supply increase
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore.add(daiDepositAmount),
        0.01 // 0.01% or 1 basis point
      );
    });
    it("Only vault can deposit some DAI to the strategy", async function () {
      const {
        dai,
        makerDsrStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", dai);
      await dai
        .connect(vaultSigner)
        .transfer(makerDsrStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = makerDsrStrategy
          .connect(signer)
          .deposit(dai.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all DAI to strategy", async function () {
      const {
        dai,
        makerDsrStrategy,
        vaultSigner,
        strategist,
        oldTimelock,
        timelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", dai);
      await dai
        .connect(vaultSigner)
        .transfer(makerDsrStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = makerDsrStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await makerDsrStrategy.connect(vaultSigner).depositAll();
      await expect(tx).to.emit(makerDsrStrategy, "Deposit");
    });
  });

  describe("with the strategy having some DAI in Maker DSR Strategy", () => {
    const loadFixture = createFixtureLoader(makerDsrFixture, {
      daiMintAmount: 12000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should be able to withdraw all", async () => {
      const { dai, sDAI, makerDsrStrategy, ousd, vault, vaultSigner } = fixture;

      const daiWithdrawAmountExpected = await sDAI.maxWithdraw(
        makerDsrStrategy.address
      );
      log(`Expected to withdraw ${formatUnits(daiWithdrawAmountExpected)} DAI`);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultDaiBalanceBefore = await dai.balanceOf(vault.address);

      log("Before withdraw all from strategy");

      // Now try to withdraw all the WETH from the strategy
      const tx = await makerDsrStrategy.connect(vaultSigner).withdrawAll();

      log("After withdraw all from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(makerDsrStrategy, "Withdrawal")
        .withNamedArgs({ _asset: dai.address, _pToken: sDAI.address });

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "Withdrawal");
      log(`Actual withdrawal amount: ${formatUnits(event.args[2])}`);
      expect(event.args[2]).to.approxEqualTolerance(
        daiWithdrawAmountExpected,
        0.01
      );

      // Check the OUSD total supply stays the same
      expect(await ousd.totalSupply()).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the DAI amount in the vault increases
      expect(await dai.balanceOf(vault.address)).to.approxEqualTolerance(
        vaultDaiBalanceBefore.add(daiWithdrawAmountExpected),
        0.01
      );
    });
    it("Vault should be able to withdraw some DAI", async () => {
      const { dai, sDAI, makerDsrStrategy, ousd, vault, vaultSigner } = fixture;

      const withdrawAmount = await units("1000", dai);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultDaiBalanceBefore = await dai.balanceOf(vault.address);

      log(`Before withdraw of ${formatUnits(withdrawAmount)} from strategy`);

      // Now try to withdraw the DAI from the strategy
      const tx = await makerDsrStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, dai.address, withdrawAmount);

      log("After withdraw from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(makerDsrStrategy, "Withdrawal")
        .withArgs(dai.address, sDAI.address, withdrawAmount);

      // Check the OUSD total supply stays the same
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the DAI balance in the Vault
      expect(await dai.balanceOf(vault.address)).to.equal(
        vaultDaiBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some DAI from AMO strategy", async function () {
      const {
        makerDsrStrategy,
        oethVault,
        strategist,
        timelock,
        oldTimelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, oldTimelock, josh]) {
        const tx = makerDsrStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all DAI from Maker DSR strategy", async function () {
      const { makerDsrStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = makerDsrStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = makerDsrStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(makerDsrStrategy, "Withdrawal");
    });
  });

  describe("administration", () => {
    const loadFixture = createFixtureLoader(makerDsrFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Governor should not be able to set the platform token", () => {
      const { frxETH, sfrxETH, makerDsrStrategy, timelock } = fixture;

      const tx = makerDsrStrategy
        .connect(timelock)
        .setPTokenAddress(frxETH.address, sfrxETH.address);
      expect(tx).to.be.revertedWith("unsupported function");
    });
    it("Governor should not be able to remove the platform token", () => {
      const { makerDsrStrategy, timelock } = fixture;

      const tx = makerDsrStrategy.connect(timelock).removePToken(0);
      expect(tx).to.be.revertedWith("unsupported function");
    });
  });
});
