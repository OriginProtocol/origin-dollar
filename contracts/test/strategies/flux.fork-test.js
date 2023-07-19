const { expect } = require("chai");

const {
  fluxStrategyFixtureSetup,
  impersonateAndFundContract,
  defaultFixtureSetup,
} = require("../_fixture");
const { units, ousdUnits, forkOnlyDescribe } = require("../helpers");

const fluxStrategyFixture = fluxStrategyFixtureSetup();

forkOnlyDescribe("Flux strategy", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await fluxStrategyFixture();
  });

  after(async () => {
    // This is needed to revert fixtures
    // The other tests as of now don't use proper fixtures
    // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
    const f = defaultFixtureSetup();
    await f();
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
      const vaultSigner = await impersonateAndFundContract(vault.address);
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
  const vaultSigner = await impersonateAndFundContract(vault.address);

  await fluxStrategy
    .connect(vaultSigner)
    .withdraw(vault.address, asset.address, assetUnits);
  const vaultAssetBalDiff = (await asset.balanceOf(vault.address)).sub(
    vaultAssetBalBefore
  );

  expect(vaultAssetBalDiff).to.approxEqualTolerance(assetUnits, 1);
}
