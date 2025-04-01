const { expect } = require("chai");

const {
  units,
  ousdUnits,
  differenceInErc20TokenBalance,
  advanceBlocks,
  advanceTime,
  isCI,
} = require("../helpers");
const { createFixtureLoader, morphoCompoundFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

describe.skip("ForkTest: Morpho Compound Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(morphoCompoundFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should deploy USDC in Morpho Compound", async function () {
      const { matt, usdc } = fixture;
      await mintTest(fixture, matt, usdc, "110000");
    });

    it("Should deploy USDT in Morpho Compound", async function () {
      const { josh, usdt } = fixture;
      await mintTest(fixture, josh, usdt, "200000");
    });

    it("Should deploy USDS in Morpho Compound", async function () {
      const { anna, usds } = fixture;
      await mintTest(fixture, anna, usds, "110000");
    });
  });

  describe("Redeem", function () {
    it("Should redeem from Morpho", async () => {
      const { vault, ousd, usdt, usdc, usds, domen } = fixture;

      await vault.connect(domen).rebase();

      const supplyBeforeMint = await ousd.totalSupply();

      const amount = "20020";

      // Mint with all three assets
      for (const asset of [usdt, usdc, usds]) {
        await vault
          .connect(domen)
          .mint(asset.address, await units(amount, asset), 0);
      }

      const currentSupply = await ousd.totalSupply();
      const supplyAdded = currentSupply.sub(supplyBeforeMint);
      expect(supplyAdded).to.approxEqualTolerance(ousdUnits("60000"), 1);

      const currentBalance = await ousd.connect(domen).balanceOf(domen.address);

      // Now try to redeem 30k
      await vault.connect(domen).redeem(ousdUnits("30000"), 0);

      // User balance should be down by 30k
      const newBalance = await ousd.connect(domen).balanceOf(domen.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub(ousdUnits("30000")),
        1
      );

      const newSupply = await ousd.totalSupply();
      const supplyDiff = currentSupply.sub(newSupply);

      expect(supplyDiff).to.approxEqualTolerance(ousdUnits("30000"), 1);
    });
  });

  describe("Withdraw", function () {
    it("Should be able to withdraw from strategy", async function () {
      const { matt, usdc, vault, morphoCompoundStrategy } = fixture;
      const amount = "110000";
      await mintTest(fixture, matt, usdc, amount);

      const usdcUnits = await units(amount, usdc);
      const vaultUsdcBefore = await usdc.balanceOf(vault.address);
      const vaultSigner = await impersonateAndFund(vault.address);

      await morphoCompoundStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, usdc.address, usdcUnits);
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(usdcUnits, 1);
    });

    it("Should be able to withdrawAll from strategy", async function () {
      const { matt, usdc, vault, usdt, morphoCompoundStrategy } = fixture;
      const vaultSigner = await impersonateAndFund(vault.address);
      const amount = "110000";

      const usdcUnits = await units(amount, usdc);
      const usdtUnits = await units(amount, usdt);

      await vault.connect(matt).mint(usdt.address, usdtUnits, 0);
      await vault.connect(matt).mint(usdc.address, usdcUnits, 0);

      await vault.connect(matt).rebase();
      await vault.connect(matt).allocate();

      const vaultUsdtBefore = await usdt.balanceOf(vault.address);
      const vaultUsdcBefore = await usdc.balanceOf(vault.address);

      const stratBalUsdc = await morphoCompoundStrategy.checkBalance(
        usdc.address
      );
      const stratBalUsdt = await morphoCompoundStrategy.checkBalance(
        usdt.address
      );

      await morphoCompoundStrategy.connect(vaultSigner).withdrawAll();

      const vaultUsdtDiff =
        (await usdt.balanceOf(vault.address)) - vaultUsdtBefore;
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(stratBalUsdc, 1);
      expect(vaultUsdtDiff).to.approxEqualTolerance(stratBalUsdt, 1);

      expect(await morphoCompoundStrategy.checkBalance(usdc.address)).to.equal(
        "0"
      );
      expect(await morphoCompoundStrategy.checkBalance(usdt.address)).to.equal(
        "0"
      );
    });
  });

  // set it as a last test that executes because we advance time and theat
  // messes with recency of oracle prices
  describe("Rewards", function () {
    it("Should be able to harvest rewards", async function () {
      const {
        harvester,
        daniel,
        anna,
        usdc,
        cusdc,
        usdt,
        morphoLens,
        morphoCompoundStrategy,
        dripper,
      } = fixture;
      await mintTest(fixture, anna, usdc, "110000");

      // harvester always exchanges for USDT and parks the funds in the dripper
      const usdtBalanceDiff = await differenceInErc20TokenBalance(
        dripper.address,
        usdt,
        async () => {
          // advance time so that some rewards accrue
          await advanceTime(3600 * 24 * 1);
          await advanceBlocks(100);
          // check that rewards are there
          await expect(
            await morphoLens.getUserUnclaimedRewards(
              [cusdc.address],
              morphoCompoundStrategy.address
            )
          ).to.be.gte(0);
          // prettier-ignore
          await harvester
            .connect(daniel)["harvestAndSwap(address)"](morphoCompoundStrategy.address);
        }
      );

      expect(usdtBalanceDiff).to.be.gte(0);
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, morphoCompoundStrategy } = fixture;

  await vault.connect(user).rebase();
  await vault.connect(user).allocate();

  const unitAmount = await units(amount, asset);

  const currentSupply = await ousd.totalSupply();
  const currentBalance = await ousd.connect(user).balanceOf(user.address);
  const currentMorphoBalance = await morphoCompoundStrategy.checkBalance(
    asset.address
  );

  // Mint OUSD w/ asset
  await vault.connect(user).mint(asset.address, unitAmount, 0);
  await vault.connect(user).allocate();

  const newBalance = await ousd.connect(user).balanceOf(user.address);
  const newSupply = await ousd.totalSupply();
  const newMorphoBalance = await morphoCompoundStrategy.checkBalance(
    asset.address
  );

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const ousdUnitAmount = ousdUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);

  const morphoLiquidityDiff = newMorphoBalance.sub(currentMorphoBalance);

  // Should have liquidity in Morpho
  expect(morphoLiquidityDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}
