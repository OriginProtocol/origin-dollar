const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { forkOnlyDescribe, ousdUnits } = require("../helpers");
const {
  withBalancedMetaPool,
  addLiquidity,
  withLiquidityOnBalancedPool,
  removeAllLiquidity,
  removeLiquidityImbalanced,
  get3CRVLiquidity,
  withOUSDTitledMetapool,
  withLiquidityOn3CRVTitledPool,
  withCRV3TitledMetapool,
  withLiquidityOnOUSDTitledPool,
} = require("../_metastrategies-fixtures");

forkOnlyDescribe("OUSD MetaPool Liquidity Test", function () {
  this.timeout(0);

  describe("Balanced metapool", () => {
    describe("Add Liquidity", () => {
      it("Should add balanced liquidity ", async function () {
        const fixture = await loadFixture(withBalancedMetaPool);
        const { daniel, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $10k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);
        const currentLPBalance = await ousdMetaPool.balanceOf(
          daniel.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, daniel);

        const newLPBalance = await ousdMetaPool.balanceOf(daniel.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(ousdAmount.mul(2), 1);
      });

      it("Should add imbalanced liquidity", async function () {
        const fixture = await loadFixture(withBalancedMetaPool);
        const { franck, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $5k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        const currentLPBalance = await ousdMetaPool.balanceOf(
          franck.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, franck);

        const newLPBalance = await ousdMetaPool.balanceOf(franck.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(
          ousdAmount.mul(3).div(2),
          1
        );
      });
    });

    describe("Remove Liquidity", () => {
      it("Should remove balanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOnBalancedPool);
        const { threePoolToken, ousd, daniel } = fixture;
        const address = daniel.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        await removeAllLiquidity(fixture, daniel);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        const amount = ousdUnits("10000").mul(2);
        expect(ousdDiff.add(crv3Diff)).to.be.approxEqualTolerance(amount, 10);
      });

      it("Should remove imbalanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOnBalancedPool);
        const { threePoolToken, ousd, franck } = fixture;
        const address = franck.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        await removeLiquidityImbalanced(fixture, franck, crv3Liquidity);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        expect(crv3Diff).to.be.approxEqualTolerance(ousdUnits("5000"), 5);
        expect(ousdDiff).to.be.approxEqualTolerance(ousdUnits("25000"), 5);
      });
    });
  });

  describe("OUSD tilted metapool", () => {
    describe("Add Liquidity", () => {
      it("Should add balanced liquidity ", async function () {
        const fixture = await loadFixture(withOUSDTitledMetapool);
        const { daniel, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $10k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);
        const currentLPBalance = await ousdMetaPool.balanceOf(
          daniel.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, daniel);

        const newLPBalance = await ousdMetaPool.balanceOf(daniel.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(ousdAmount.mul(2), 1);
      });

      it("Should add imbalanced liquidity", async function () {
        const fixture = await loadFixture(withOUSDTitledMetapool);
        const { franck, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $5k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        const currentLPBalance = await ousdMetaPool.balanceOf(
          franck.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, franck);

        const newLPBalance = await ousdMetaPool.balanceOf(franck.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(
          ousdAmount.mul(3).div(2),
          1
        );
      });
    });

    describe("Remove Liquidity", () => {
      it("Should remove balanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOnOUSDTitledPool);
        const { threePoolToken, ousd, daniel } = fixture;
        const address = daniel.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        await removeAllLiquidity(fixture, daniel);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        expect(ousdDiff.add(crv3Diff)).to.be.approxEqualTolerance(
          ousdUnits("20000"),
          10
        );
      });

      it("Should remove imbalanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOnOUSDTitledPool);
        const { threePoolToken, ousd, franck } = fixture;
        const address = franck.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        await removeLiquidityImbalanced(fixture, franck, crv3Liquidity);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        expect(ousdDiff.add(crv3Diff)).to.be.approxEqualTolerance(
          ousdUnits("30000"),
          10
        );
      });
    });
  });

  describe("3CRV tilted metapool", () => {
    describe("Add Liquidity", () => {
      it("Should add balanced liquidity ", async function () {
        const fixture = await loadFixture(withCRV3TitledMetapool);
        const { daniel, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $10k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);
        const currentLPBalance = await ousdMetaPool.balanceOf(
          daniel.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, daniel);

        const newLPBalance = await ousdMetaPool.balanceOf(daniel.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(ousdAmount.mul(2), 1);
      });

      it("Should add imbalanced liquidity", async function () {
        const fixture = await loadFixture(withCRV3TitledMetapool);
        const { franck, ousdMetaPool } = fixture;

        // 10k OUSD
        const ousdAmount = ousdUnits("10000");
        // $5k of 3CRV
        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        const currentLPBalance = await ousdMetaPool.balanceOf(
          franck.getAddress()
        );

        await addLiquidity(fixture, ousdAmount, crv3Liquidity, franck);

        const newLPBalance = await ousdMetaPool.balanceOf(franck.getAddress());
        const balanceDiff = newLPBalance.sub(currentLPBalance);
        expect(balanceDiff).to.be.approxEqualTolerance(
          ousdAmount.mul(3).div(2),
          1
        );
      });
    });

    describe("Remove Liquidity", () => {
      it("Should remove balanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOn3CRVTitledPool);
        const { threePoolToken, ousd, daniel } = fixture;
        const address = daniel.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        await removeAllLiquidity(fixture, daniel);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        expect(ousdDiff.add(crv3Diff)).to.be.approxEqualTolerance(
          ousdUnits("20000"),
          10
        );
      });

      it("Should remove imbalanced liquidity", async function () {
        const fixture = await loadFixture(withLiquidityOn3CRVTitledPool);
        const { threePoolToken, ousd, franck } = fixture;
        const address = franck.getAddress();

        const current3CRVBalance = await threePoolToken.balanceOf(address);
        const currentOUSDBalance = await ousd.balanceOf(address);

        const crv3Liquidity = await get3CRVLiquidity(
          fixture,
          ousdUnits("5000")
        );
        await removeLiquidityImbalanced(fixture, franck, crv3Liquidity);

        const new3CRVBalance = await threePoolToken.balanceOf(address);
        const newOUSDBalance = await ousd.balanceOf(address);

        const ousdDiff = newOUSDBalance.sub(currentOUSDBalance);
        const crv3Diff = new3CRVBalance.sub(current3CRVBalance);

        expect(ousdDiff.add(crv3Diff)).to.be.approxEqualTolerance(
          ousdUnits("30000"),
          10
        );
      });
    });
  });
});
