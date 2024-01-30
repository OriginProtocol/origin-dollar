const hre = require("hardhat");
const { expect } = require("chai");

const { units, oethUnits, isCI } = require("../helpers");

const {
  createFixtureLoader,
  fraxETHStrategyFixture,
} = require("./../_fixture");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");

const loadFixture = createFixtureLoader(fraxETHStrategyFixture);

describe("ForkTest: FraxETH Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should allow mint with frxETH", async () => {
      const { daniel, frxETH } = fixture;

      await mintTest(fixture, daniel, frxETH, "12.3");
    });

    it("Should allow mint with WETH", async () => {
      const { daniel, weth } = fixture;

      await mintTest(fixture, daniel, weth, "13.244");
    });
  });

  describe("Deposit/Allocation", function () {
    it("Should accept and handle WETH allocation", async () => {
      const { oethVault, weth, sfrxETH, domen, fraxEthStrategy } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      const amount = "12.345";

      // Transfer some WETH to strategy
      await weth
        .connect(domen)
        .transfer(fraxEthStrategy.address, oethUnits(amount));

      // Call deposit by impersonating the Vault
      const tx = await fraxEthStrategy
        .connect(fakeVaultSigner)
        .deposit(weth.address, oethUnits(amount));

      expect(tx)
        .to.emit(fraxEthStrategy, "Deposit")
        .withArgs(weth.address, sfrxETH.address, oethUnits(amount));
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdrawing frxETH", async () => {
      const { oethVault, fraxEthStrategy, frxETH, daniel, domen } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      // Make sure the strategy has some frxETH
      await mintTest(fixture, daniel, frxETH, "13.432");

      const balanceBefore = await fraxEthStrategy.checkBalance(frxETH.address);

      // Do a withdraw with impersonated Vault
      await fraxEthStrategy
        .connect(fakeVaultSigner)
        .withdraw(domen.address, frxETH.address, oethUnits("12"));

      const balanceAfter = await fraxEthStrategy.checkBalance(frxETH.address);

      expect(balanceBefore.sub(balanceAfter)).to.approxEqualTolerance(
        oethUnits("12")
      );
    });

    it("Should not allow withdrawing WETH", async () => {
      const { oethVault, fraxEthStrategy, weth } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      await expect(
        fraxEthStrategy
          .connect(fakeVaultSigner)
          .withdraw(weth.address, weth.address, oethUnits("12"))
      ).to.be.revertedWith("Unexpected asset address");
    });
    // TODO: Reenable this after FraxETH strategy has been upgraded
    it.skip("Should allow withdrawAll twice", async () => {
      const { oethVault, fraxEthStrategy } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      // Do a withdrawAll with impersonated Vault
      await fraxEthStrategy.connect(fakeVaultSigner).withdrawAll();

      // Do a second withdrawAll, both should work.
      await fraxEthStrategy.connect(fakeVaultSigner).withdrawAll();
    });

    it("Should not allow withdrawing WETH", async () => {
      const { oethVault, fraxEthStrategy, weth } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      await expect(
        fraxEthStrategy
          .connect(fakeVaultSigner)
          .withdraw(weth.address, weth.address, oethUnits("12"))
      ).to.be.revertedWith("Unexpected asset address");
    });
  });

  describe("Balance/Assets", function () {
    it("Should support WETH and frxETH", async () => {
      const { fraxEthStrategy, weth, frxETH } = fixture;
      expect(await fraxEthStrategy.supportsAsset(weth.address)).to.be.true;
      expect(await fraxEthStrategy.supportsAsset(frxETH.address)).to.be.true;
    });

    it("Should not support anything else", async () => {
      const { fraxEthStrategy, reth } = fixture;
      expect(await fraxEthStrategy.supportsAsset(reth.address)).to.be.false;
    });

    // Leaving this out since mint already covers it
    // it("Should show frxETH balance", async () => {})

    it("Should always have a WETH balance of zero", async () => {
      const { fraxEthStrategy, weth } = fixture;
      expect(await fraxEthStrategy.checkBalance(weth.address)).to.eq(0);

      // Mint some WETH to strategy
      await setERC20TokenBalance(fraxEthStrategy.address, weth, "1235", hre);

      // Ensure still 0
      expect(await fraxEthStrategy.checkBalance(weth.address)).to.eq(0);
    });

    it("Should throw if unsupported asset", async () => {
      const { fraxEthStrategy, reth } = fixture;
      await expect(
        fraxEthStrategy.checkBalance(reth.address)
      ).to.be.revertedWith("Unexpected asset address");
    });
  });
});

async function mintTest(fixture, user, asset, amount = "10.34") {
  const { oethVault, oeth, weth, frxETH, fraxEthStrategy } = fixture;

  await oethVault.connect(user).allocate();
  await oethVault.connect(user).rebase();

  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentFrxETHBalance = await fraxEthStrategy.checkBalance(
    frxETH.address
  );

  // Mint OETH w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newStrategyFrxETHBal = await fraxEthStrategy.checkBalance(
    frxETH.address
  );
  const newStrategyWETHBal = await fraxEthStrategy.checkBalance(weth.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const oethUnitAmount = oethUnits(amount);
  expect(supplyDiff).to.approxEqualTolerance(oethUnitAmount, 1);

  if (asset.address == frxETH.address) {
    // Should deposit if it's frxETH

    // Ensrue WETH balance is 0
    expect(newStrategyWETHBal).to.equal(
      "0",
      "Should not have any leftover WETH"
    );

    const frxETHBalDiff = newStrategyFrxETHBal.sub(currentFrxETHBalance);

    // Should have staked it in the Vault
    expect(frxETHBalDiff).to.approxEqualTolerance(oethUnits(amount), 1);
  } else {
    // Should not deposit WETH by default
    expect(newStrategyWETHBal).to.equal("0");
  }
}
