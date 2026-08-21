const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader, creditMarketAMOFixture } = require("../_fixture");
const { isCI } = require("../helpers");

const log = require("../../utils/logger")("test:fork:credit-market-amo");

// OToken amounts are 18 decimals; OUSD's hard asset (USDC) is 6.
const oUnits = (n) => parseUnits(n, 18);
const usdcUnits = (n) => parseUnits(n, 6);

describe("ForkTest: Credit Market AMO Strategy (OUSD)", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  const loadFixture = createFixtureLoader(creditMarketAMOFixture, {
    oTokenSymbol: "OUSD",
  });
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should have constants and immutables set", async () => {
    const { creditAMOStrategy, creditVault, oTokenVault, oToken, hardAsset } =
      fixture;

    expect(await creditAMOStrategy.oToken()).to.equal(oToken.address);
    expect(await creditAMOStrategy.hardAsset()).to.equal(hardAsset.address);
    expect(await creditAMOStrategy.creditVault()).to.equal(creditVault.address);
    expect(await creditAMOStrategy.platformAddress()).to.equal(
      creditVault.address
    );
    expect(await creditAMOStrategy.vaultAddress()).to.equal(
      oTokenVault.address
    );
    expect(await creditAMOStrategy.oTokenDecimals()).to.equal(18);
    expect(await creditAMOStrategy.hardAssetDecimals()).to.equal(6);
    expect(await creditAMOStrategy.supportsAsset(hardAsset.address)).to.equal(
      true
    );
  });

  it("Should mint, supply, accrue and burn against the live OUSD Vault", async () => {
    const { creditAMOStrategy, creditVault, oToken, hardAsset, oTokenVault } =
      fixture;
    const { governor } = fixture;

    const supplyBefore = await oToken.totalSupply();
    const vaultValueBefore = await oTokenVault.totalValue();

    // Mint OToken and supply it to the credit vault.
    await creditAMOStrategy.connect(governor).mintAndSupply(oUnits("100000"));

    expect(await creditAMOStrategy.netMinted()).to.equal(oUnits("100000"));
    expect(await creditAMOStrategy.checkBalance(hardAsset.address)).to.equal(
      usdcUnits("100000")
    );

    // Minting raises OToken supply and the position backs it 1:1 -> neutral.
    expect(await oToken.totalSupply()).to.approxEqualTolerance(
      supplyBefore.add(oUnits("100000")),
      0.01
    );
    expect(await oTokenVault.totalValue()).to.approxEqualTolerance(
      vaultValueBefore.add(oUnits("100000")),
      0.1
    );

    // Interest accrues on the position and lifts checkBalance (yield to holders).
    await creditVault.simulateInterest(oUnits("500"));
    expect(await creditAMOStrategy.accruedYield()).to.equal(oUnits("500"));
    expect(await creditAMOStrategy.checkBalance(hardAsset.address)).to.equal(
      usdcUnits("100500")
    );

    // Burn the 100k of liquid OToken. Yield-first accounting draws the 500 of accrued
    // interest down first, so netMinted settles on the 500 residual position value.
    await creditAMOStrategy.connect(governor).redeemAndBurn(oUnits("100000"));

    expect(await creditAMOStrategy.netMinted()).to.equal(oUnits("500"));
    expect(await creditAMOStrategy.positionValue()).to.equal(oUnits("500"));
    expect(await creditAMOStrategy.maxWithdrawable()).to.equal(0);
    expect(await creditAMOStrategy.checkBalance(hardAsset.address)).to.equal(
      usdcUnits("500")
    );

    // Net: OToken supply back to ~start, vault value up by the accrued ~500 of yield.
    expect(await oToken.totalSupply()).to.approxEqualTolerance(
      supplyBefore,
      0.01
    );
    expect(await oTokenVault.totalValue()).to.approxEqualTolerance(
      vaultValueBefore.add(oUnits("500")),
      0.1
    );
    log("Completed mint -> accrue -> burn lifecycle on the live OUSD Vault");
  });

  it("Should withdraw only the liquid portion when partially lent out", async () => {
    const { creditAMOStrategy, creditVault, oTokenVault, josh } = fixture;
    const { governor } = fixture;

    await creditAMOStrategy.connect(governor).mintAndSupply(oUnits("100000"));

    // 60k borrowed/drawn out -> 40k liquid, position value unchanged.
    await creditVault.simulateBorrow(oUnits("60000"), josh.address);
    expect(await creditAMOStrategy.maxWithdrawable()).to.equal(oUnits("40000"));

    const vaultSigner = fixture.oTokenVaultSigner;
    await creditAMOStrategy.connect(vaultSigner).withdrawAll();

    // Burned the liquid 40k; the 60k still lent out remains in the position.
    expect(await creditAMOStrategy.netMinted()).to.equal(oUnits("60000"));
    expect(await creditAMOStrategy.positionValue()).to.equal(oUnits("60000"));
    expect(await creditAMOStrategy.maxWithdrawable()).to.equal(0);

    // Governor can still remove the rest once it frees up; no revert when dry.
    await creditAMOStrategy.connect(governor).withdrawAll();
    expect(await creditAMOStrategy.netMinted()).to.equal(oUnits("60000"));

    expect(await oTokenVault.totalValue()).to.be.gt(0);
  });
});
