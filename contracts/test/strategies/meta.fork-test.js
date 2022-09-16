const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { isForkTest, expectApproxSupply, units } = require("../helpers");
const { convexMetaVaultFixture } = require("../_fixture");

// Ugly hack to avoid running these tests when running `npx hardhat test` directly.
// A right way would be to add suffix to files and use patterns to filter
const forkDescribe = isForkTest ? describe : describe.skip;

forkDescribe("Convex 3pool/OUSD Meta Strategy", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(convexMetaVaultFixture);
  });

  describe("Mint", function () {
    async function mintTest(user, asset, amount = "30000") {
      const { vault, ousd, usdt, ousdMetaPool, cvxBooster } = fixture;

      const unitAmount = await units(amount, asset);

      const currentSupply = await ousd.totalSupply();
      const currentBalance = await ousd.connect(user).balanceOf(user.address);

      // Mint OUSD w/ asset
      await vault.connect(user).mint(asset.address, unitAmount, 0);

      // Ensure 2x OUSD has been added to supply (in case of USDT)
      // 1x for USDC and DAI
      await expectApproxSupply(
        ousd,
        (await units(amount, ousd))
          .mul(asset.address === usdt.address ? 2 : 1)
          .add(currentSupply)
      );

      // Ensure user has correct balance (w/ 1% slippage tolerance)
      const newBalance = await ousd.connect(user).balanceOf(user.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.add(await units(amount, ousd)),
        1
      );

      // // TODO: Check why this is zero on fork for USDT??
      // if (asset.address === usdt.address) {
      //   console.log(await ousdMetaPool.connect(user).balanceOf(cvxBooster.address))
      // }
    }

    it("Should stake USDT in Cruve guage via metapool", async function () {
      const { josh, usdt } = fixture;
      await mintTest(josh, usdt);
    });

    it("Should NOT stake USDC in Cruve guage via metapool", async function () {
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

      // // Force vault to reallocate USDT to OUSDMetaStrategy.
      // // Not necessary as of now, since vaultBuffer is zero on mainnet
      // await vault.connect(originTeam).allocate()

      const amount = "10000";

      // Mint with all three assets
      for (const asset of [usdt, usdc, dai]) {
        await vault
          .connect(anna)
          .mint(asset.address, await units(amount, asset), 0);
      }

      // Total supply should be up by (10k x 2) + 10k + 10k = 40k
      const currentSupply = await ousd.totalSupply();
      const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

      // Now try to redeem 30k
      await vault.connect(anna).redeem(units("30000", ousd), 0);

      // Supply should be down by 40k
      await expectApproxSupply(
        ousd,
        currentSupply.sub((await units(amount, ousd)).mul(4))
      );

      // User balance should be down by 30k
      const newBalance = await ousd.connect(anna).balanceOf(anna.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub((await units(amount, ousd)).mul(3)),
        1
      );
    });
  });
});
