const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { units, isCI } = require("../helpers");

const {
  createFixtureLoader,
  morphoGauntletPrimeUSDTFixture,
} = require("../_fixture");

const log = require("../../utils/logger");

describe("ForkTest: Morpho Gauntlet Prime USDT Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(morphoGauntletPrimeUSDTFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { vault, morphoGauntletPrimeUSDTStrategy } = fixture;

      expect(await morphoGauntletPrimeUSDTStrategy.platformAddress()).to.equal(
        addresses.mainnet.MorphoGauntletPrimeUSDTVault
      );
      expect(await morphoGauntletPrimeUSDTStrategy.vaultAddress()).to.equal(
        vault.address
      );
      expect(await morphoGauntletPrimeUSDTStrategy.shareToken()).to.equal(
        addresses.mainnet.MorphoGauntletPrimeUSDTVault
      );
      expect(await morphoGauntletPrimeUSDTStrategy.assetToken()).to.equal(
        addresses.mainnet.USDT
      );
      expect(
        await morphoGauntletPrimeUSDTStrategy.supportsAsset(
          addresses.mainnet.USDT
        )
      ).to.equal(true);
      expect(
        await morphoGauntletPrimeUSDTStrategy.assetToPToken(
          addresses.mainnet.USDT
        )
      ).to.equal(addresses.mainnet.MorphoGauntletPrimeUSDTVault);
      expect(await morphoGauntletPrimeUSDTStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
      expect(await vault.getAllStrategies()).to.include(
        morphoGauntletPrimeUSDTStrategy.address
      );
    });
    it("Should be able to check balance", async () => {
      const { usdt, josh, morphoGauntletPrimeUSDTStrategy } = fixture;

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await morphoGauntletPrimeUSDTStrategy
        .connect(josh)
        .populateTransaction.checkBalance(usdt.address);
      await josh.sendTransaction(tx);
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        oldTimelock,
        strategist,
        josh,
        daniel,
        domen,
        morphoGauntletPrimeUSDTStrategy,
        vaultSigner,
      } = fixture;

      for (const signer of [
        daniel,
        domen,
        josh,
        strategist,
        oldTimelock,
        vaultSigner,
      ]) {
        const tx = morphoGauntletPrimeUSDTStrategy
          .connect(signer)
          .safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some USDT in the vault", () => {
    const loadFixture = createFixtureLoader(morphoGauntletPrimeUSDTFixture, {
      usdtMintAmount: 12000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Vault should deposit some USDT to strategy", async function () {
      const {
        usdt,
        ousd,
        morphoGauntletPrimeUSDTStrategy,
        vault,
        strategist,
        vaultSigner,
      } = fixture;

      const checkBalanceBefore =
        await morphoGauntletPrimeUSDTStrategy.checkBalance(usdt.address);

      const usdtDepositAmount = await units("1000", usdt);

      // Vault transfers USDT to strategy
      await usdt
        .connect(vaultSigner)
        .transfer(morphoGauntletPrimeUSDTStrategy.address, usdtDepositAmount);

      await vault.connect(strategist).rebase();

      const ousdSupplyBefore = await ousd.totalSupply();

      const tx = await morphoGauntletPrimeUSDTStrategy
        .connect(vaultSigner)
        .deposit(usdt.address, usdtDepositAmount);

      // Check emitted event
      await expect(tx)
        .to.emit(morphoGauntletPrimeUSDTStrategy, "Deposit")
        .withArgs(
          usdt.address,
          addresses.mainnet.MorphoGauntletPrimeUSDTVault,
          usdtDepositAmount
        );

      // Check the OUSD total supply increase
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore.add(usdtDepositAmount),
        0.1 // 0.1% or 10 basis point
      );
      expect(
        await morphoGauntletPrimeUSDTStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(
        checkBalanceBefore.add(usdtDepositAmount),
        0.01
      ); // 0.01% or 1 basis point
    });
    it("Only vault can deposit some USDT to the strategy", async function () {
      const {
        usdt,
        morphoGauntletPrimeUSDTStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdt);
      await usdt
        .connect(vaultSigner)
        .transfer(morphoGauntletPrimeUSDTStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = morphoGauntletPrimeUSDTStrategy
          .connect(signer)
          .deposit(usdt.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all USDT to strategy", async function () {
      const {
        usdt,
        morphoGauntletPrimeUSDTStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdt);
      await usdt
        .connect(vaultSigner)
        .transfer(morphoGauntletPrimeUSDTStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = morphoGauntletPrimeUSDTStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await morphoGauntletPrimeUSDTStrategy
        .connect(vaultSigner)
        .depositAll();
      await expect(tx).to.emit(morphoGauntletPrimeUSDTStrategy, "Deposit");
    });
  });

  describe("with the strategy having some USDT", () => {
    const loadFixture = createFixtureLoader(morphoGauntletPrimeUSDTFixture, {
      usdtMintAmount: 12000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Vault should be able to withdraw all", async () => {
      const {
        usdt,
        morphoGauntletPrimeUSDTVault,
        morphoGauntletPrimeUSDTStrategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const usdtWithdrawAmountExpected =
        await morphoGauntletPrimeUSDTVault.maxWithdraw(
          morphoGauntletPrimeUSDTStrategy.address
        );

      log(
        `Expected to withdraw ${formatUnits(usdtWithdrawAmountExpected)} USDT`
      );

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDTBalanceBefore = await usdt.balanceOf(vault.address);

      log("Before withdraw all from strategy");

      // Now try to withdraw all the WETH from the strategy
      const tx = await morphoGauntletPrimeUSDTStrategy
        .connect(vaultSigner)
        .withdrawAll();

      log("After withdraw all from strategy");

      // Check emitted event
      await expect(tx).to.emittedEvent("Withdrawal", [
        usdt.address,
        morphoGauntletPrimeUSDTVault.address,
        (amount) =>
          expect(amount).approxEqualTolerance(
            usdtWithdrawAmountExpected,
            0.01,
            "Withdrawal amount"
          ),
      ]);

      // Check the OUSD total supply stays the same
      expect(await ousd.totalSupply()).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDT amount in the vault increases
      expect(await usdt.balanceOf(vault.address)).to.approxEqualTolerance(
        vaultUSDTBalanceBefore.add(usdtWithdrawAmountExpected),
        0.01
      );
    });
    it("Vault should be able to withdraw some USDT", async () => {
      const {
        usdt,
        morphoGauntletPrimeUSDTVault,
        morphoGauntletPrimeUSDTStrategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const withdrawAmount = await units("1000", usdt);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDTBalanceBefore = await usdt.balanceOf(vault.address);

      log(`Before withdraw of ${formatUnits(withdrawAmount)} from strategy`);

      // Now try to withdraw the USDT from the strategy
      const tx = await morphoGauntletPrimeUSDTStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, usdt.address, withdrawAmount);

      log("After withdraw from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(morphoGauntletPrimeUSDTStrategy, "Withdrawal")
        .withArgs(
          usdt.address,
          morphoGauntletPrimeUSDTVault.address,
          withdrawAmount
        );

      // Check the OUSD total supply stays the same
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the USDT balance in the Vault
      expect(await usdt.balanceOf(vault.address)).to.equal(
        vaultUSDTBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some USDT from strategy", async function () {
      const {
        morphoGauntletPrimeUSDTStrategy,
        oethVault,
        strategist,
        timelock,
        oldTimelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, oldTimelock, josh]) {
        const tx = morphoGauntletPrimeUSDTStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all USDT from Maker DSR strategy", async function () {
      const { morphoGauntletPrimeUSDTStrategy, strategist, timelock, josh } =
        fixture;

      for (const signer of [strategist, josh]) {
        const tx = morphoGauntletPrimeUSDTStrategy
          .connect(signer)
          .withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = morphoGauntletPrimeUSDTStrategy
        .connect(timelock)
        .withdrawAll();
      await expect(tx).to.emit(morphoGauntletPrimeUSDTStrategy, "Withdrawal");
    });
  });

  describe("administration", () => {
    const loadFixture = createFixtureLoader(morphoGauntletPrimeUSDTFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Governor should not be able to set the platform token", () => {
      const { frxETH, sfrxETH, morphoGauntletPrimeUSDTStrategy, timelock } =
        fixture;

      const tx = morphoGauntletPrimeUSDTStrategy
        .connect(timelock)
        .setPTokenAddress(frxETH.address, sfrxETH.address);
      expect(tx).to.be.revertedWith("unsupported function");
    });
    it("Governor should not be able to remove the platform token", () => {
      const { morphoGauntletPrimeUSDTStrategy, timelock } = fixture;

      const tx = morphoGauntletPrimeUSDTStrategy
        .connect(timelock)
        .removePToken(0);
      expect(tx).to.be.revertedWith("unsupported function");
    });
  });
});
