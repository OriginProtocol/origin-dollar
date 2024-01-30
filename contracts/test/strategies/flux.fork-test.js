const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { fluxStrategyFixture, createFixtureLoader } = require("../_fixture");
const { units, ousdUnits, isCI } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

describe("Flux strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(fluxStrategyFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Post deployment", () => {
    it("Should be initialized", async () => {
      const { fluxStrategy } = fixture;

      expect(await fluxStrategy.supportsAsset(addresses.mainnet.DAI)).to.equal(
        true
      );
      expect(await fluxStrategy.supportsAsset(addresses.mainnet.USDC)).to.equal(
        true
      );
      expect(await fluxStrategy.supportsAsset(addresses.mainnet.USDT)).to.equal(
        true
      );
      expect(await fluxStrategy.assetToPToken(addresses.mainnet.DAI)).to.equal(
        addresses.mainnet.fDAI
      );
      expect(await fluxStrategy.assetToPToken(addresses.mainnet.USDC)).to.equal(
        addresses.mainnet.fUSDC
      );
      expect(await fluxStrategy.assetToPToken(addresses.mainnet.USDT)).to.equal(
        addresses.mainnet.fUSDT
      );
      expect(await fluxStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
      expect(await fluxStrategy.platformAddress()).to.equal(addresses.dead);
      expect(await fluxStrategy.vaultAddress()).to.equal(
        addresses.mainnet.VaultProxy
      );
      expect(await fluxStrategy.harvesterAddress()).to.equal(
        addresses.mainnet.HarvesterProxy
      );
    });
  });
  describe("Mint", function () {
    it("Should deploy USDC to Flux strategy", async function () {
      const { matt, usdc } = fixture;
      await mintTest(fixture, matt, usdc, "12000");
    });

    it("Should deploy USDT to Flux strategy", async function () {
      const { josh, usdt } = fixture;
      await mintTest(fixture, josh, usdt, "50000");
    });

    it("Should deploy DAI to Flux strategy", async function () {
      const { anna, dai } = fixture;
      await mintTest(fixture, anna, dai, "43500");
    });
  });

  describe("Withdraw", function () {
    it("Should be able to withdraw from DAI strategy", async function () {
      const { domen, dai } = fixture;
      await withdrawTest(fixture, domen, dai, "28000");
    });

    it("Should be able to withdraw from USDT strategy", async function () {
      const { franck, usdt } = fixture;
      await withdrawTest(fixture, franck, usdt, "33000");
    });

    it("Should be able to withdraw from USDC strategy", async function () {
      const { daniel, usdc } = fixture;
      await withdrawTest(fixture, daniel, usdc, "25000");
    });

    it("Should be able to withdrawAll from strategy", async function () {
      const { matt, usdc, vault, usdt, fluxStrategy } = fixture;
      const vaultSigner = await impersonateAndFund(vault.address);
      const amount = "110000";

      const removeFundsFromVault = async () => {
        await usdc
          .connect(vaultSigner)
          .transfer(matt.address, usdc.balanceOf(vault.address));
        await usdt
          .connect(vaultSigner)
          .transfer(matt.address, usdt.balanceOf(vault.address));
      };

      // remove funds so no residual funds get allocated
      await removeFundsFromVault();

      await mintTest(fixture, matt, usdc, amount);
      await mintTest(fixture, matt, usdt, amount);

      const usdcUnits = await units(amount, usdc);
      const usdtUnits = await units(amount, usdt);
      const vaultUsdtBefore = await usdt.balanceOf(vault.address);
      const vaultUsdcBefore = await usdc.balanceOf(vault.address);

      await fluxStrategy.connect(vaultSigner).withdrawAll();

      const vaultUsdtDiff =
        (await usdt.balanceOf(vault.address)) - vaultUsdtBefore;
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(usdcUnits, 1);
      expect(vaultUsdtDiff).to.approxEqualTolerance(usdtUnits, 1);
    });
  });

  describe("Administration", function () {
    it("Anyone should be able to approve all assets", async function () {
      const { dai, usdc, usdt, josh, fluxStrategy } = fixture;
      const tx = await fluxStrategy.connect(josh).safeApproveAllTokens();
      await expect(tx).to.emit(dai, "Approval");
      await expect(tx).to.emit(usdc, "Approval");
      await expect(tx).to.emit(usdt, "Approval");
    });
    it("Only governor should be able to remove a platform token", async function () {
      const { dai, fdai, usdc, fusdc, usdt, fusdt, fluxStrategy, timelock } =
        fixture;

      const tx = await fluxStrategy.connect(timelock).removePToken(0);

      await expect(tx)
        .to.emit(fluxStrategy, "PTokenRemoved")
        .withArgs(dai.address, fdai.address);

      expect(await fluxStrategy.supportsAsset(dai.address)).to.equal(false);
      expect(await fluxStrategy.supportsAsset(usdc.address)).to.equal(true);
      expect(await fluxStrategy.supportsAsset(usdt.address)).to.equal(true);
      expect(await fluxStrategy.assetToPToken(dai.address)).to.equal(
        addresses.zero
      );
      expect(await fluxStrategy.assetToPToken(usdc.address)).to.equal(
        fusdc.address
      );
      expect(await fluxStrategy.assetToPToken(usdt.address)).to.equal(
        fusdt.address
      );
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, fluxStrategy } = fixture;

  await vault.connect(user).allocate();

  const unitAmount = await units(amount, asset);

  const currentSupply = await ousd.totalSupply();
  const currentBalance = await ousd.connect(user).balanceOf(user.address);
  const currentStrategyBalance = await fluxStrategy.checkBalance(asset.address);

  // Mint OUSD w/ asset
  await vault.connect(user).mint(asset.address, unitAmount, 0);
  await vault.connect(user).allocate();

  const newBalance = await ousd.connect(user).balanceOf(user.address);
  const newSupply = await ousd.totalSupply();
  const newStrategyBalance = await fluxStrategy.checkBalance(asset.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const ousdUnitAmount = ousdUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);

  const strategyLiquidityDiff = newStrategyBalance.sub(currentStrategyBalance);

  // Should have liquidity in the strategy
  expect(strategyLiquidityDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}

async function withdrawTest(fixture, user, asset, amount = "25000") {
  const { vault, fluxStrategy } = fixture;
  await mintTest(fixture, user, asset, amount);

  const assetUnits = await units(amount, asset);
  const vaultAssetBalBefore = await asset.balanceOf(vault.address);
  const vaultSigner = await impersonateAndFund(vault.address);

  await fluxStrategy
    .connect(vaultSigner)
    .withdraw(vault.address, asset.address, assetUnits);
  const vaultAssetBalDiff = (await asset.balanceOf(vault.address)).sub(
    vaultAssetBalBefore
  );

  expect(vaultAssetBalDiff).to.approxEqualTolerance(assetUnits, 1);
}
