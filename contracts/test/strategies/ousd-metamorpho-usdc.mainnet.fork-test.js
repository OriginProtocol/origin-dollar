const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { units, isCI } = require("../helpers");

const { createFixtureLoader, metaMorphoFixture } = require("../_fixture");

const log = require("../../utils/logger");

describe("ForkTest: MetaMorpho USDC Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(metaMorphoFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { vault, OUSDMetaMorphoStrategy } = fixture;

      expect(await OUSDMetaMorphoStrategy.platformAddress()).to.equal(
        addresses.mainnet.MetaMorphoUSDCSteakHouseVault
      );
      expect(await OUSDMetaMorphoStrategy.vaultAddress()).to.equal(
        vault.address
      );
      expect(await OUSDMetaMorphoStrategy.shareToken()).to.equal(
        addresses.mainnet.MetaMorphoUSDCSteakHouseVault
      );
      expect(await OUSDMetaMorphoStrategy.assetToken()).to.equal(
        addresses.mainnet.USDC
      );
      expect(
        await OUSDMetaMorphoStrategy.supportsAsset(addresses.mainnet.USDC)
      ).to.equal(true);
      expect(
        await OUSDMetaMorphoStrategy.assetToPToken(addresses.mainnet.USDC)
      ).to.equal(addresses.mainnet.MetaMorphoUSDCSteakHouseVault);
      expect(await OUSDMetaMorphoStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
    });
    it("Should be able to check balance", async () => {
      const { usdc, josh, OUSDMetaMorphoStrategy } = fixture;

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await OUSDMetaMorphoStrategy.connect(
        josh
      ).populateTransaction.checkBalance(usdc.address);
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
        OUSDMetaMorphoStrategy,
        usdc,
        vaultSigner,
      } = fixture;

      // Governor can approve all tokens
      const tx = await OUSDMetaMorphoStrategy.connect(
        timelock
      ).safeApproveAllTokens();
      await expect(tx).to.emit(usdc, "Approval");

      for (const signer of [
        daniel,
        domen,
        josh,
        strategist,
        oldTimelock,
        vaultSigner,
      ]) {
        const tx =
          OUSDMetaMorphoStrategy.connect(signer).safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some USDC in the vault", () => {
    const loadFixture = createFixtureLoader(metaMorphoFixture, {
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
        OUSDMetaMorphoStrategy,
        vault,
        strategist,
        vaultSigner,
      } = fixture;

      const checkBalanceBefore = await OUSDMetaMorphoStrategy.checkBalance(
        usdc.address
      );

      const usdcDepositAmount = await units("1000", usdc);

      // Vault transfers USDC to strategy
      await usdc
        .connect(vaultSigner)
        .transfer(OUSDMetaMorphoStrategy.address, usdcDepositAmount);

      await vault.connect(strategist).rebase();

      const ousdSupplyBefore = await ousd.totalSupply();

      const tx = await OUSDMetaMorphoStrategy.connect(vaultSigner).deposit(
        usdc.address,
        usdcDepositAmount
      );

      // Check emitted event
      await expect(tx)
        .to.emit(OUSDMetaMorphoStrategy, "Deposit")
        .withArgs(
          usdc.address,
          addresses.mainnet.MetaMorphoUSDCSteakHouseVault,
          usdcDepositAmount
        );

      // Check the OUSD total supply increase
      const ousdSupplyAfter = await ousd.totalSupply();
      expect(ousdSupplyAfter).to.approxEqualTolerance(
        ousdSupplyBefore.add(usdcDepositAmount),
        0.1 // 0.1% or 10 basis point
      );
      expect(
        await OUSDMetaMorphoStrategy.checkBalance(usdc.address)
      ).to.approxEqualTolerance(
        checkBalanceBefore.add(usdcDepositAmount),
        0.01
      ); // 0.01% or 1 basis point
    });
    it("Only vault can deposit some USDC to the strategy", async function () {
      const {
        usdc,
        OUSDMetaMorphoStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdc);
      await usdc
        .connect(vaultSigner)
        .transfer(OUSDMetaMorphoStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = OUSDMetaMorphoStrategy.connect(signer).deposit(
          usdc.address,
          depositAmount
        );

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all USDC to strategy", async function () {
      const {
        usdc,
        OUSDMetaMorphoStrategy,
        vaultSigner,
        strategist,
        timelock,
        oldTimelock,
        josh,
      } = fixture;

      const depositAmount = await units("50", usdc);
      await usdc
        .connect(vaultSigner)
        .transfer(OUSDMetaMorphoStrategy.address, depositAmount);

      for (const signer of [strategist, oldTimelock, timelock, josh]) {
        const tx = OUSDMetaMorphoStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await OUSDMetaMorphoStrategy.connect(vaultSigner).depositAll();
      await expect(tx).to.emit(OUSDMetaMorphoStrategy, "Deposit");
    });
  });

  describe("with the strategy having some USDC in MetaMorpho Strategy", () => {
    const loadFixture = createFixtureLoader(metaMorphoFixture, {
      usdcMintAmount: 12000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Vault should be able to withdraw all", async () => {
      const {
        usdc,
        usdcMetaMorphoSteakHouseVault,
        OUSDMetaMorphoStrategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const usdcWithdrawAmountExpected =
        await usdcMetaMorphoSteakHouseVault.maxWithdraw(
          OUSDMetaMorphoStrategy.address
        );

      log(
        `Expected to withdraw ${formatUnits(usdcWithdrawAmountExpected)} USDC`
      );

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDCBalanceBefore = await usdc.balanceOf(vault.address);

      log("Before withdraw all from strategy");

      // Now try to withdraw all the WETH from the strategy
      const tx = await OUSDMetaMorphoStrategy.connect(
        vaultSigner
      ).withdrawAll();

      log("After withdraw all from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(OUSDMetaMorphoStrategy, "Withdrawal")
        .withNamedArgs({
          _asset: usdc.address,
          _pToken: usdcMetaMorphoSteakHouseVault.address,
        });

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "Withdrawal");
      log(`Actual withdrawal amount: ${formatUnits(event.args[2])}`);
      expect(event.args[2]).to.approxEqualTolerance(
        usdcWithdrawAmountExpected,
        0.01
      );

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
        usdcMetaMorphoSteakHouseVault,
        OUSDMetaMorphoStrategy,
        ousd,
        vault,
        vaultSigner,
      } = fixture;

      const withdrawAmount = await units("1000", usdc);

      const ousdSupplyBefore = await ousd.totalSupply();
      const vaultUSDCBalanceBefore = await usdc.balanceOf(vault.address);

      log(`Before withdraw of ${formatUnits(withdrawAmount)} from strategy`);

      // Now try to withdraw the USDC from the strategy
      const tx = await OUSDMetaMorphoStrategy.connect(vaultSigner).withdraw(
        vault.address,
        usdc.address,
        withdrawAmount
      );

      log("After withdraw from strategy");

      // Check emitted event
      await expect(tx)
        .to.emit(OUSDMetaMorphoStrategy, "Withdrawal")
        .withArgs(
          usdc.address,
          usdcMetaMorphoSteakHouseVault.address,
          withdrawAmount
        );

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
        OUSDMetaMorphoStrategy,
        oethVault,
        strategist,
        timelock,
        oldTimelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, oldTimelock, josh]) {
        const tx = OUSDMetaMorphoStrategy.connect(signer).withdraw(
          oethVault.address,
          weth.address,
          parseUnits("50")
        );

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all USDC from Maker DSR strategy", async function () {
      const { OUSDMetaMorphoStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = OUSDMetaMorphoStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = OUSDMetaMorphoStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(OUSDMetaMorphoStrategy, "Withdrawal");
    });
  });

  describe("administration", () => {
    const loadFixture = createFixtureLoader(metaMorphoFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Governor should not be able to set the platform token", () => {
      const { frxETH, sfrxETH, OUSDMetaMorphoStrategy, timelock } = fixture;

      const tx = OUSDMetaMorphoStrategy.connect(timelock).setPTokenAddress(
        frxETH.address,
        sfrxETH.address
      );
      expect(tx).to.be.revertedWith("unsupported function");
    });
    it("Governor should not be able to remove the platform token", () => {
      const { OUSDMetaMorphoStrategy, timelock } = fixture;

      const tx = OUSDMetaMorphoStrategy.connect(timelock).removePToken(0);
      expect(tx).to.be.revertedWith("unsupported function");
    });
  });
});
