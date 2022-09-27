const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, ousdUnits, forkOnlyDescribe } = require("../helpers");
const { convexGeneralizedMetaForkedFixture } = require("../_fixture");

const metastrategies = [
  {
    token: "alUSD",
    metapoolAddress: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
    metastrategyProxyName: "ConvexalUSDMetaStrategyProxy",
    rewardPoolAddress: "0x02E2151D4F351881017ABdF2DD2b51150841d5B3"
  },
  {
    token: "mUSD",
    metapoolAddress: "0x8474DdbE98F5aA3179B3B3F5942D724aFcdec9f6",
    metastrategyProxyName: "ConvexmUSDMetaStrategyProxy",
    rewardPoolAddress: "0xDBFa6187C79f4fE4Cda20609E75760C5AaE88e52"
  },
  {
    token: "USDD",
    metapoolAddress: "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea",
    metastrategyProxyName: "ConvexUSDDMetaStrategyProxy",
    rewardPoolAddress: "0x7D475cc8A5E0416f0e63042547aDB94ca7045A5b"
  },
  {
    token: "BUSD",
    metapoolAddress: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
    metastrategyProxyName: "ConvexBUSDMetaStrategyProxy",
    rewardPoolAddress: "0xbD223812d360C9587921292D0644D18aDb6a2ad0"
  }
]

metastrategies.forEach(({ token, metapoolAddress, metastrategyProxyName, rewardPoolAddress }) => {
  //forkOnlyDescribe("Convex 3pool/OUSD Meta Strategy", function () {
  describe(`Convex 3pool/${token} Meta Strategy`, function () {
    this.timeout(0);

    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(await convexGeneralizedMetaForkedFixture(
        metapoolAddress,
        rewardPoolAddress,
        metastrategyProxyName,
      ));
    });

    describe("Mint", function () {
      async function mintTest(user, asset, amount = "30000") {
        const {
          vault,
          ousd,
          usdt,
          usdc,
          dai,
          rewardPool
        } = fixture;
        // pre-allocate just in case vault was holding some funds
        await vault.connect(user).allocate();
        await vault.connect(user).rebase();
        const unitAmount = await units(amount, asset);

        const currentSupply = await ousd.totalSupply();
        const currentBalance = await ousd.connect(user).balanceOf(user.address);
        const currentRewardPoolBalance = await rewardPool
          .connect(user)
          .balanceOf(fixture.metaStrategyProxy.address);

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
        expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

        // Ensure some LP tokens got staked under metaStrategy address
        const newRewardPoolBalance = await rewardPool
          .connect(user)
          .balanceOf(fixture.metaStrategyProxy.address);

        const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
          currentRewardPoolBalance
        );

        if (asset.address === dai.address) {
          // Should not have staked when minted with DAI
          expect(rewardPoolBalanceDiff).to.equal("0");
        } else {
          // Should have staked the LP tokens for USDT and USDC
          expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
            ousdUnits(amount),
            5
          );
        }
      }

      it("Should NOT stake DAI in Cruve guage via metapool", async function () {
        const { anna, dai } = fixture;
        await mintTest(anna, dai, "432000");
      });

      it("Should stake USDT in Cruve guage via metapool", async function () {
        const { josh, usdt } = fixture;
        await mintTest(josh, usdt, "100000");
      });

      it("Should stake USDC in Cruve guage via metapool", async function () {
        const { matt, usdc } = fixture;
        await mintTest(matt, usdc, "345000");
      });
    });

    describe("Redeem", function () {
      it("Should redeem", async () => {
        const { vault, ousd, usdt, usdc, dai, anna, rewardPool } = fixture;
        await vault.connect(anna).allocate();
        await vault.connect(anna).rebase();

        const supplyBeforeMint = await ousd.totalSupply();

        const amount = "10000";

        // Mint with all three assets
        for (const asset of [usdt, usdc, dai]) {
          await vault
            .connect(anna)
            .mint(asset.address, await units(amount, asset), 0);
        }
        await vault.connect(anna).allocate();

        const currentSupply = await ousd.totalSupply();
        const supplyAdded = currentSupply.sub(supplyBeforeMint);
        expect(supplyAdded).to.be.gte("30000");

        const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

        const tokens = await rewardPool
          .connect(anna)
          .balanceOf(fixture.metaStrategyProxy.address);

        // Now try to redeem 30k - 1% (possible undervaluation of coins)
        await vault.connect(anna).redeem(ousdUnits("29700"), 0);

        // User balance should be down by 30k - 1%
        const newBalance = await ousd.connect(anna).balanceOf(anna.address);
        expect(currentBalance).to.approxEqualTolerance(
          newBalance.add(ousdUnits("29700")),
          1
        );

        const newSupply = await ousd.totalSupply();
        const supplyDiff = currentSupply.sub(newSupply);

        expect(supplyDiff).to.be.gte(ousdUnits("29700").sub(ousdUnits("29700").div(100)));
      });
    });
  });
});
