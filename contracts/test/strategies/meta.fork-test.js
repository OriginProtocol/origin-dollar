const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { isForkTest, units, ousdUnits } = require("../helpers");
const {
  withBalancedMetaPool,
  withCRV3TitledMetapool,
  withOUSDTitledMetapool,
} = require("../_metastrategies-fixtures");

// Ugly hack to avoid running these tests when running `npx hardhat test` directly.
// A right way would be to add suffix to files and use patterns to filter
const forkDescribe = isForkTest ? describe : describe.skip;

forkDescribe("Convex 3pool/OUSD Meta Strategy", function () {
  this.timeout(0);

  describe("Balanced metapool", () => {
    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(withBalancedMetaPool);
    });

    describe("Mint", function () {
      async function mintTest(user, asset, amount = "30000") {
        const { vault, ousd, usdt, usdc } = fixture;

        const unitAmount = await units(amount, asset);

        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(user).balanceOf(user.address);

        // Mint OUSD w/ asset
        await vault.connect(user).mint(asset.address, unitAmount, 0);
        await vault.connect(user).allocate();

        // Ensure user has correct balance (w/ 1% slippage tolerance)
        const newBalance = await ousd.connect(user).balanceOf(user.address);
        const balanceDiff = newBalance.sub(currentBalance);
        expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

        // Supply checks
        const newSupply = await ousd.totalSupply();
        const supplyDiff = newSupply.sub(currentSupply);
        if ([usdt.address, usdc.address].includes(asset.address)) {
          // Ensure 2x OUSD has been added to supply
          // (in case of USDT/USDC)
          expect(supplyDiff).to.approxEqualTolerance(
            ousdUnits(amount).mul(2),
            1
          );
        } else {
          // 1x for DAI
          expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount), 1);
        }

        // // TODO: Check why this is zero on fork for USDT??
        // const { ousdMetaPool, cvxBooster } = fixture
        // console.log(await ousdMetaPool.connect(user).balanceOf(cvxBooster.address))
      }

      it("Should stake USDT in Cruve guage via metapool", async function () {
        const { josh, usdt } = fixture;
        await mintTest(josh, usdt, "10000");
      });

      it("Should stake USDC in Cruve guage via metapool", async function () {
        const { matt, usdc } = fixture;
        await mintTest(matt, usdc, "34500");
      });

      it("Should NOT stake DAI in Cruve guage via metapool", async function () {
        const { anna, dai } = fixture;
        await mintTest(anna, dai, "43200");
      });
    });

    describe("Redeem", function () {
      it("Should redeem", async () => {
        const { vault, ousd, usdt, usdc, dai, anna } = fixture;

        const amount = "10000";

        // Mint with all three assets
        for (const asset of [usdt, usdc, dai]) {
          await vault
            .connect(anna)
            .mint(asset.address, await units(amount, asset), 0);
        }

        // Total supply should be up by (10k x 2) + (10k x 2) + 10k = 50k
        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

        // Now try to redeem 30k
        await vault.connect(anna).redeem(ousdUnits("30000"), 0);

        // User balance should be down by 30k
        const newBalance = await ousd.connect(anna).balanceOf(anna.address);
        expect(newBalance).to.approxEqualTolerance(
          currentBalance.sub(ousdUnits("30000")),
          1
        );

        const newSupply = await ousd.totalSupply();
        const supplyDiff = currentSupply.sub(newSupply);

        expect(supplyDiff).to.gte(ousdUnits("30000"));
      });
    });
  });

  describe("Titled to 3CRV", () => {
    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(withCRV3TitledMetapool);
    });

    describe("Mint", function () {
      async function mintTest(user, asset, amount = "30000") {
        const { vault, ousd, usdt, usdc } = fixture;

        const unitAmount = await units(amount, asset);

        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(user).balanceOf(user.address);

        // Mint OUSD w/ asset
        await vault.connect(user).mint(asset.address, unitAmount, 0);
        await vault.connect(user).allocate();

        // Ensure user has correct balance (w/ 1% slippage tolerance)
        const newBalance = await ousd.connect(user).balanceOf(user.address);
        const balanceDiff = newBalance.sub(currentBalance);
        expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

        // Supply checks
        const newSupply = await ousd.totalSupply();
        const supplyDiff = newSupply.sub(currentSupply);
        if ([usdt.address, usdc.address].includes(asset.address)) {
          // Ensure at least 1.5x OUSD has been added to supply
          // (in case of USDT/USDC)
          expect(supplyDiff).to.be.gte(ousdUnits(amount).mul(3).div(2));
        } else {
          // 1x for DAI
          expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount), 1);
        }
      }

      it("Should stake USDT in Cruve guage via metapool", async function () {
        const { josh, usdt } = fixture;
        await mintTest(josh, usdt, "10000");
      });

      it("Should stake USDC in Cruve guage via metapool", async function () {
        const { matt, usdc } = fixture;
        await mintTest(matt, usdc, "34500");
      });

      it("Should NOT stake DAI in Cruve guage via metapool", async function () {
        const { anna, dai } = fixture;
        await mintTest(anna, dai, "43200");
      });
    });

    describe("Redeem", function () {
      it("Should redeem", async () => {
        const { vault, ousd, usdt, usdc, dai, anna } = fixture;

        const amount = "10000";

        // Mint with all three assets
        for (const asset of [usdt, usdc, dai]) {
          await vault
            .connect(anna)
            .mint(asset.address, await units(amount, asset), 0);
        }

        // Total supply should be up by (10k x 2) + (10k x 2) + 10k = 50k
        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

        // Now try to redeem 30k
        await vault.connect(anna).redeem(ousdUnits("30000"), 0);

        // User balance should be down by 30k
        const newBalance = await ousd.connect(anna).balanceOf(anna.address);
        expect(newBalance).to.approxEqualTolerance(
          currentBalance.sub(ousdUnits("30000")),
          1
        );

        const newSupply = await ousd.totalSupply();
        const supplyDiff = currentSupply.sub(newSupply);

        expect(supplyDiff).to.gte(ousdUnits("30000"));
      });
    });
  });

  describe("Titled to OUSD", () => {
    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(withOUSDTitledMetapool);
    });

    describe("Mint", function () {
      async function mintTest(user, asset, amount = "30000") {
        const { vault, ousd } = fixture;

        const unitAmount = await units(amount, asset);

        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(user).balanceOf(user.address);

        // Mint OUSD w/ asset
        await vault.connect(user).mint(asset.address, unitAmount, 0);
        await vault.connect(user).allocate();

        // Ensure user has correct balance (w/ 1% slippage tolerance)
        const newBalance = await ousd.connect(user).balanceOf(user.address);
        const balanceDiff = newBalance.sub(currentBalance);
        expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

        // Supply checks
        const newSupply = await ousd.totalSupply();
        const supplyDiff = newSupply.sub(currentSupply);

        // Ensure about ~1x OUSD has been added to supply
        expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount), 1);
      }

      it("Should stake USDT in Cruve guage via metapool", async function () {
        const { josh, usdt } = fixture;
        await mintTest(josh, usdt, "10000");
      });

      it("Should stake USDC in Cruve guage via metapool", async function () {
        const { matt, usdc } = fixture;
        await mintTest(matt, usdc, "34500");
      });

      it("Should NOT stake DAI in Cruve guage via metapool", async function () {
        const { anna, dai } = fixture;
        await mintTest(anna, dai, "43200");
      });
    });

    describe("Redeem", function () {
      it("Should redeem", async () => {
        const { vault, ousd, usdt, usdc, dai, anna } = fixture;

        const amount = "10000";

        // Mint with all three assets
        for (const asset of [usdt, usdc, dai]) {
          await vault
            .connect(anna)
            .mint(asset.address, await units(amount, asset), 0);
        }

        // Total supply should be up by (10k x 2) + (10k x 2) + 10k = 50k
        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

        // Now try to redeem 30k
        await vault.connect(anna).redeem(ousdUnits("30000"), 0);

        // User balance should be down by 30k
        const newBalance = await ousd.connect(anna).balanceOf(anna.address);
        expect(newBalance).to.approxEqualTolerance(
          currentBalance.sub(ousdUnits("30000")),
          1
        );

        const newSupply = await ousd.totalSupply();
        const supplyDiff = currentSupply.sub(newSupply);

        expect(supplyDiff).to.gte(ousdUnits("30000"));
      });
    });
  });
});
