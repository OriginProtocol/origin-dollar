const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { canWithdrawAllFromMorphoOUSD } = require("../../utils/morpho");
const { getMerklRewards } = require("../../tasks/merkl");
const { units, isCI } = require("../helpers");

const { createFixtureLoader, morphoOUSDv2Fixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:ousd-v2-morpho");

describe("ForkTest: Yearn's Morpho OUSD v2 Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(morphoOUSDv2Fixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { vault, morphoOUSDv2Strategy } = fixture;

      expect(await morphoOUSDv2Strategy.platformAddress()).to.equal(
        addresses.mainnet.MorphoOUSDv2Vault
      );
      expect(await morphoOUSDv2Strategy.vaultAddress()).to.equal(vault.address);
      expect(await morphoOUSDv2Strategy.shareToken()).to.equal(
        addresses.mainnet.MorphoOUSDv2Vault
      );
      expect(await morphoOUSDv2Strategy.assetToken()).to.equal(
        addresses.mainnet.USDC
      );
      expect(
        await morphoOUSDv2Strategy.supportsAsset(addresses.mainnet.USDC)
      ).to.equal(true);
      expect(
        await morphoOUSDv2Strategy.assetToPToken(addresses.mainnet.USDC)
      ).to.equal(addresses.mainnet.MorphoOUSDv2Vault);
      expect(await morphoOUSDv2Strategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
    });
    it("Should be able to check balance", async () => {
      const { usdc, josh, morphoOUSDv2Strategy } = fixture;

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await morphoOUSDv2Strategy
        .connect(josh)
        .populateTransaction.checkBalance(usdc.address);
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
        morphoOUSDv2Strategy,
        usdc,
        vaultSigner,
      } = fixture;

      // Governor can approve all tokens
      const tx = await morphoOUSDv2Strategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(usdc, "Approval");

      for (const signer of [
        daniel,
        domen,
        josh,
        strategist,
        oldTimelock,
        vaultSigner,
      ]) {
        const tx = morphoOUSDv2Strategy.connect(signer).safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some USDC in the vault", () => {
    const loadFixture = createFixtureLoader(morphoOUSDv2Fixture, {
      usdcMintAmount: 12000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Vault should deposit some USDC to strategy", async function () {
      const {
        usdc,
        ousd,
        morphoOUSDv2Strategy,
        vault,
        strategist,
        vaultSigner,
      } = fixture;

      const checkBalanceBefore = await morphoOUSDv2Strategy.checkBalance(
        usdc.address
      );

      const usdcDepositAmount = await units("1000", usdc);

      // Vault transfers USDC to strategy
      await usdc
        .connect(vaultSigner)
        .transfer(morphoOUSDv2Strategy.address, usdcDepositAmount);

      await vault.connect(strategist).rebase();

      const ousdSupplyBefore = await ousd.totalSupply();

      const tx = await morphoOUSDv2Strategy
        .connect(vaultSigner)
        .deposit(usdc.address, usdcDepositAmount);

      // Check emitted event
      await expect(tx)
        .to.emit(morphoOUSDv2Strategy, "Deposit")
        .withArgs(
          usdc.address,
          addresses.mainnet.MorphoOUSDv2Vault,
          usdcDepositAmount
        );

      // Check the OUSD total supply increase
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore.add(usdcDepositAmount),
        0.1 // 0.1% or 10 basis point
      );
      expect(
        await morphoOUSDv2Strategy.checkBalance(usdc.address)
      ).to.approxEqualTolerance(
        checkBalanceBefore.add(usdcDepositAmount),
        0.01
      ); // 0.01% or 1 basis point
    });
    it("Only vault can deposit some USDC to the strategy", async function () {
      const {
        usdc,
        morphoOUSDv2Strategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdc);
      await usdc
        .connect(vaultSigner)
        .transfer(morphoOUSDv2Strategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = morphoOUSDv2Strategy
          .connect(signer)
          .deposit(usdc.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all USDC to strategy", async function () {
      const {
        usdc,
        morphoOUSDv2Strategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdc);
      await usdc
        .connect(vaultSigner)
        .transfer(morphoOUSDv2Strategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = morphoOUSDv2Strategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await morphoOUSDv2Strategy.connect(vaultSigner).depositAll();
      await expect(tx).to.emit(morphoOUSDv2Strategy, "Deposit");
    });
  });

  describe("with the strategy having some USDC in Morpho Strategy", () => {
    const loadFixture = createFixtureLoader(morphoOUSDv2Fixture, {
      usdcMintAmount: 12000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Vault should be able to withdraw all", async () => {
      const {
        usdc,
        morphoOUSDv2Vault,
        morphoOUSDv2Strategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const minBalance = await units("12000", usdc);
      const strategyVaultShares = await morphoOUSDv2Vault.balanceOf(
        morphoOUSDv2Strategy.address
      );
      const usdcWithdrawAmountExpected =
        await morphoOUSDv2Vault.convertToAssets(strategyVaultShares);
      expect(usdcWithdrawAmountExpected).to.be.gte(minBalance.sub(1));

      log(
        `Expected to withdraw ${formatUnits(
          usdcWithdrawAmountExpected,
          6
        )} USDC`
      );

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDCBalanceBefore = await usdc.balanceOf(vault.address);

      log("Before withdraw all from strategy");

      const withdrawAllAllowed = await canWithdrawAllFromMorphoOUSD();

      // If there is not enough liquidity in the Morpho OUSD v1 Vault, skip the withdrawAll test
      if (withdrawAllAllowed === false) return;

      // Now try to withdraw all the WETH from the strategy
      const tx = await morphoOUSDv2Strategy.connect(vaultSigner).withdrawAll();

      log("After withdraw all from strategy");

      // Check emitted event
      await expect(tx).to.emittedEvent("Withdrawal", [
        usdc.address,
        morphoOUSDv2Vault.address,
        (amount) =>
          expect(amount).approxEqualTolerance(
            usdcWithdrawAmountExpected,
            0.01,
            "Withdrawal amount"
          ),
      ]);

      // Check the OUSD total supply stays the same
      expect(await ousd.totalSupply()).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDC amount in the vault increases
      expect(await usdc.balanceOf(vault.address)).to.approxEqualTolerance(
        vaultUSDCBalanceBefore.add(usdcWithdrawAmountExpected),
        0.01
      );
    });
    it("Vault should be able to withdraw some USDC", async () => {
      const {
        usdc,
        morphoOUSDv2Vault,
        morphoOUSDv2Strategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const withdrawAmount = await units("1000", usdc);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDCBalanceBefore = await usdc.balanceOf(vault.address);

      log(`Before withdraw of ${formatUnits(withdrawAmount, 6)} from strategy`);

      // Now try to withdraw the USDC from the strategy
      const tx = await morphoOUSDv2Strategy
        .connect(vaultSigner)
        .withdraw(vault.address, usdc.address, withdrawAmount);

      log("After withdraw from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(morphoOUSDv2Strategy, "Withdrawal")
        .withArgs(usdc.address, morphoOUSDv2Vault.address, withdrawAmount);

      // Check the OUSD total supply stays the same
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDC balance in the Vault
      expect(await usdc.balanceOf(vault.address)).to.equal(
        vaultUSDCBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some USDC from strategy", async function () {
      const {
        morphoOUSDv2Strategy,
        oethVault,
        strategist,
        timelock,
        oldTimelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, oldTimelock, josh]) {
        const tx = morphoOUSDv2Strategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all USDC from the strategy", async function () {
      const { morphoOUSDv2Strategy, strategist, timelock, josh } = fixture;

      const withdrawAllAllowed = await canWithdrawAllFromMorphoOUSD();

      // If there is not enough liquidity in the Morpho OUSD v1 Vault, skip the withdrawAll test
      if (withdrawAllAllowed === false) return;

      for (const signer of [strategist, josh]) {
        const tx = morphoOUSDv2Strategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = morphoOUSDv2Strategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(morphoOUSDv2Strategy, "Withdrawal");
    });
  });

  describe("claim and collect MORPHO rewards", () => {
    const loadFixture = createFixtureLoader(morphoOUSDv2Fixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should claim MORPHO rewards", async () => {
      const { josh, morphoOUSDv2Strategy, morphoToken } = fixture;

      const { amount, proofs } = await getMerklRewards({
        userAddress: morphoOUSDv2Strategy.address,
        chainId: 1,
      });
      log(`MORPHO rewards available to claim: ${formatUnits(amount, 18)}`);

      if (amount != 0) {
        const tx = await morphoOUSDv2Strategy
          .connect(josh)
          .merkleClaim(morphoToken.address, amount, proofs);
        await expect(tx)
          .to.emit(morphoOUSDv2Strategy, "ClaimedRewards")
          .withArgs(morphoToken.address, amount);
      }
    });

    it("Should be able to collect MORPHO rewards", async () => {
      const { buyBackSigner, josh, morphoOUSDv2Strategy, morphoToken } =
        fixture;

      const { amount, proofs } = await getMerklRewards({
        userAddress: morphoOUSDv2Strategy.address,
        chainId: 1,
      });
      log(`MORPHO rewards available to claim: ${formatUnits(amount, 18)}`);

      if (amount != "0") {
        await morphoOUSDv2Strategy
          .connect(josh)
          .merkleClaim(morphoToken.address, amount, proofs);
      }

      const expectMorphoTransfer = await morphoToken.balanceOf(
        morphoOUSDv2Strategy.address
      );

      const tx = await morphoOUSDv2Strategy
        .connect(buyBackSigner)
        .collectRewardTokens();

      if (expectMorphoTransfer.gt(0)) {
        // The amount is total claimed over time and not the amount of rewards claimed in this tx
        await expect(tx)
          .to.emit(morphoToken, "Transfer")
          .withArgs(
            morphoOUSDv2Strategy.address,
            await buyBackSigner.getAddress(),
            expectMorphoTransfer
          );
      }
    });
  });
});
