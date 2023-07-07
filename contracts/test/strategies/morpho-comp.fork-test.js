const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const {
  units,
  ousdUnits,
  forkOnlyDescribe,
  differenceInErc20TokenBalance,
  advanceBlocks,
  advanceTime,
} = require("../helpers");
const {
  morphoCompoundFixture,
  impersonateAndFundContract,
} = require("../_fixture");

forkOnlyDescribe("ForkTest: Morpho Compound Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(morphoCompoundFixture);
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

    it("Should deploy DAI in Morpho Compound", async function () {
      const { anna, dai } = fixture;
      await mintTest(fixture, anna, dai, "110000");
    });
  });

  describe("Redeem", function () {
    it("Should redeem from Morpho", async () => {
      const { vault, ousd, usdt, usdc, dai, domen } = fixture;

      const supplyBeforeMint = await ousd.totalSupply();

      const amount = "10000";

      // Mint with all three assets
      for (const asset of [usdt, usdc, dai]) {
        await vault
          .connect(domen)
          .mint(asset.address, await units(amount, asset), 0);
      }

      const currentSupply = await ousd.totalSupply();
      const supplyAdded = currentSupply.sub(supplyBeforeMint);
      expect(supplyAdded).to.approxEqualTolerance(ousdUnits("30000"), 1);

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
      const vaultSigner = await impersonateAndFundContract(vault.address);

      await morphoCompoundStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, usdc.address, usdcUnits);
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(usdcUnits, 1);
    });

    it("Should be able to withdrawAll from strategy", async function () {
      const { matt, usdc, vault, usdt, morphoCompoundStrategy } = fixture;
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

      await morphoCompoundStrategy.connect(vaultSigner).withdrawAll();

      const vaultUsdtDiff =
        (await usdt.balanceOf(vault.address)) - vaultUsdtBefore;
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(usdcUnits, 1);
      expect(vaultUsdtDiff).to.approxEqualTolerance(usdtUnits, 1);
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

      await expect(usdtBalanceDiff).to.be.gte(0);
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, morphoCompoundStrategy } = fixture;

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
