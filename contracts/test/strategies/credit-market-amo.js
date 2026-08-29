const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;

const { createFixtureLoader, creditMarketAMOFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

// OToken amounts are always 18 decimals (OUSD and OETH both use 18).
const oUnits = (n) => parseUnits(n, 18);

describe("Unit test: Credit Market AMO Strategy", function () {
  const configs = [
    { oTokenSymbol: "OUSD", hardAssetDecimals: 6 },
    { oTokenSymbol: "OETH", hardAssetDecimals: 18 },
  ];

  for (const cfg of configs) {
    describe(`${cfg.oTokenSymbol} config`, function () {
      const loadFixture = createFixtureLoader(creditMarketAMOFixture, {
        oTokenSymbol: cfg.oTokenSymbol,
      });
      // checkBalance is denominated in the hard asset.
      const hardUnits = (n) => parseUnits(n, cfg.hardAssetDecimals);

      let fixture;
      let strategy, creditVault, oToken, hardAsset, oTokenVault;
      let governor, vaultSigner, strategist;

      beforeEach(async () => {
        fixture = await loadFixture();
        strategy = fixture.creditAMOStrategy;
        creditVault = fixture.creditVault;
        oToken = fixture.oToken;
        hardAsset = fixture.hardAsset;
        oTokenVault = fixture.oTokenVault;
        governor = fixture.governor;
        vaultSigner = fixture.oTokenVaultSigner;
        strategist = await impersonateAndFund(
          await oTokenVault.strategistAddr()
        );
      });

      describe("config", () => {
        it("sets immutables and initial state", async () => {
          expect(await strategy.oToken()).to.equal(oToken.address);
          expect(await strategy.hardAsset()).to.equal(hardAsset.address);
          expect(await strategy.creditVault()).to.equal(creditVault.address);
          expect(await strategy.platformAddress()).to.equal(
            creditVault.address
          );
          expect(await strategy.vaultAddress()).to.equal(oTokenVault.address);
          expect(await strategy.oTokenDecimals()).to.equal(18);
          expect(await strategy.hardAssetDecimals()).to.equal(
            cfg.hardAssetDecimals
          );
          expect(await strategy.supportsAsset(hardAsset.address)).to.equal(
            true
          );
          expect(await strategy.supportsAsset(oToken.address)).to.equal(false);
          expect(await strategy.netMinted()).to.equal(0);
          expect(await strategy.mintCap()).to.equal(oUnits("1000000"));
        });
      });

      describe("mintAndSupply", () => {
        it("mints, supplies, and reports balance 1:1 (neutral)", async () => {
          const supplyBefore = await oToken.totalSupply();

          const tx = await strategy
            .connect(governor)
            .mintAndSupply(oUnits("100"));
          await expect(tx).to.emit(strategy, "Supplied");

          expect(await oToken.totalSupply()).to.approxEqualTolerance(
            supplyBefore.add(oUnits("100")),
            0.01
          );
          expect(await strategy.netMinted()).to.equal(oUnits("100"));
          expect(await strategy.positionValue()).to.equal(oUnits("100"));
          expect(await strategy.accruedYield()).to.equal(0);
          expect(await strategy.maxWithdrawable()).to.equal(oUnits("100"));
          expect(await strategy.checkBalance(hardAsset.address)).to.equal(
            hardUnits("100")
          );
        });

        it("enforces the mint cap", async () => {
          await strategy.connect(governor).setMintCap(oUnits("100"));
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          await expect(
            strategy.connect(governor).mintAndSupply(oUnits("1"))
          ).to.be.revertedWith("Mint cap exceeded");
        });

        it("reverts on zero amount", async () => {
          await expect(
            strategy.connect(governor).mintAndSupply(0)
          ).to.be.revertedWith("Must mint something");
        });

        it("is callable by the strategist", async () => {
          await strategy.connect(strategist).mintAndSupply(oUnits("10"));
          expect(await strategy.netMinted()).to.equal(oUnits("10"));
        });

        it("is not callable by others", async () => {
          await expect(
            strategy.connect(fixture.josh).mintAndSupply(oUnits("10"))
          ).to.be.revertedWith("Caller is not the Strategist or Governor");
        });
      });

      describe("interest accrual", () => {
        it("lifts checkBalance and accruedYield via the position value", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          await creditVault.simulateInterest(oUnits("1"));

          expect(await strategy.positionValue()).to.equal(oUnits("101"));
          expect(await strategy.accruedYield()).to.equal(oUnits("1"));
          expect(await strategy.netMinted()).to.equal(oUnits("100"));
          expect(await strategy.checkBalance(hardAsset.address)).to.equal(
            hardUnits("101")
          );
          // Accrued interest is a claim, not yet liquid.
          expect(await strategy.maxWithdrawable()).to.equal(oUnits("100"));
        });
      });

      describe("redeemAndBurn", () => {
        it("burns liquid OToken and stays neutral", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          const supplyBefore = await oToken.totalSupply();

          const tx = await strategy
            .connect(governor)
            .redeemAndBurn(oUnits("40"));
          await expect(tx).to.emit(strategy, "Redeemed");

          expect(await oToken.totalSupply()).to.approxEqualTolerance(
            supplyBefore.sub(oUnits("40")),
            0.01
          );
          expect(await strategy.netMinted()).to.equal(oUnits("60"));
          expect(await strategy.positionValue()).to.equal(oUnits("60"));
          expect(await strategy.checkBalance(hardAsset.address)).to.equal(
            hardUnits("60")
          );
        });

        it("is capped at the liquid amount", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          // 70 OToken borrowed/drawn out -> only 30 liquid, position value unchanged.
          await creditVault.simulateBorrow(oUnits("70"), fixture.josh.address);
          expect(await strategy.maxWithdrawable()).to.equal(oUnits("30"));
          expect(await strategy.positionValue()).to.equal(oUnits("100"));

          const withdrawn = await strategy
            .connect(governor)
            .callStatic.redeemAndBurn(oUnits("100"));
          expect(withdrawn).to.equal(oUnits("30"));

          await strategy.connect(governor).redeemAndBurn(oUnits("100"));
          expect(await strategy.netMinted()).to.equal(oUnits("70"));
          expect(await strategy.positionValue()).to.equal(oUnits("70"));
          expect(await strategy.maxWithdrawable()).to.equal(0);
        });

        it("reverts when nothing is liquid", async () => {
          await expect(
            strategy.connect(governor).redeemAndBurn(oUnits("100"))
          ).to.be.revertedWith("Nothing to withdraw");
        });

        it("draws interest down before principal (yield-first)", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          // Position grows to 130 (30 of accrued interest); liquidity stays at 100.
          await creditVault.simulateInterest(oUnits("30"));

          // Burn 50 of the liquid principal. Yield-first accounting draws the 30 of
          // interest down first, so netMinted falls by only 20 (50 - 30) to 80.
          await strategy.connect(governor).redeemAndBurn(oUnits("50"));

          expect(await strategy.positionValue()).to.equal(oUnits("80"));
          expect(await strategy.netMinted()).to.equal(oUnits("80"));
          expect(await strategy.accruedYield()).to.equal(0);
        });
      });

      describe("withdrawAll", () => {
        it("withdraws only the liquid portion and leaves the rest", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          // 60 borrowed out -> 40 liquid. withdrawAll burns the liquid 40,
          // leaving the 60 that is still lent out in the position.
          await creditVault.simulateBorrow(oUnits("60"), fixture.josh.address);

          await strategy.connect(vaultSigner).withdrawAll();

          expect(await strategy.netMinted()).to.equal(oUnits("60"));
          expect(await strategy.positionValue()).to.equal(oUnits("60"));
          expect(await strategy.maxWithdrawable()).to.equal(0);
        });

        it("is a no-op when nothing is liquid", async () => {
          await strategy.connect(governor).mintAndSupply(oUnits("100"));
          await creditVault.simulateBorrow(oUnits("100"), fixture.josh.address);

          // Does not revert even though there is nothing to withdraw.
          await strategy.connect(governor).withdrawAll();
          expect(await strategy.netMinted()).to.equal(oUnits("100"));
          expect(await strategy.positionValue()).to.equal(oUnits("100"));
        });

        it("is only callable by vault or governor", async () => {
          await expect(
            strategy.connect(fixture.josh).withdrawAll()
          ).to.be.revertedWith("Caller is not the Vault or Governor");
          await expect(
            strategy.connect(strategist).withdrawAll()
          ).to.be.revertedWith("Caller is not the Vault or Governor");
        });
      });

      describe("admin and disabled functions", () => {
        it("setMintCap is callable by governor or strategist and emits", async () => {
          const tx = await strategy.connect(governor).setMintCap(oUnits("5"));
          await expect(tx)
            .to.emit(strategy, "MintCapUpdated")
            .withArgs(oUnits("1000000"), oUnits("5"));

          // Strategist can also move the cap operationally.
          await strategy.connect(strategist).setMintCap(oUnits("7"));
          expect(await strategy.mintCap()).to.equal(oUnits("7"));

          // Others cannot.
          await expect(
            strategy.connect(fixture.josh).setMintCap(oUnits("5"))
          ).to.be.revertedWith("Caller is not the Strategist or Governor");
        });

        it("reverts disabled entry and exit", async () => {
          await expect(
            strategy
              .connect(fixture.josh)
              .deposit(hardAsset.address, oUnits("1"))
          ).to.be.revertedWith("unsupported function");
          await expect(
            strategy.connect(fixture.josh).depositAll()
          ).to.be.revertedWith("unsupported function");
          await expect(
            strategy
              .connect(fixture.josh)
              .withdraw(oTokenVault.address, hardAsset.address, oUnits("1"))
          ).to.be.revertedWith("unsupported function");
        });

        it("reverts pToken management", async () => {
          await expect(
            strategy
              .connect(governor)
              .setPTokenAddress(oToken.address, creditVault.address)
          ).to.be.revertedWith("unsupported function");
          await expect(
            strategy.connect(governor).removePToken(0)
          ).to.be.revertedWith("unsupported function");
        });

        it("checkBalance reverts for an unsupported asset", async () => {
          await expect(
            strategy.checkBalance(oToken.address)
          ).to.be.revertedWith("Unsupported asset");
        });

        it("safeApproveAllTokens is governor-only", async () => {
          await expect(
            strategy.connect(fixture.josh).safeApproveAllTokens()
          ).to.be.revertedWith("Caller is not the Governor");
        });
      });
    });
  }
});
