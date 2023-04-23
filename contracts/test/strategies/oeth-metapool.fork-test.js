const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, ousdUnits, forkOnlyDescribe } = require("../helpers");
const { convexOETHMetaVaultFixture } = require("../_fixture");

forkOnlyDescribe(
  "ForkTest: OETH Curve Metapool Strategy",
  function () {
    this.timeout(0);
    // due to hardhat forked mode timeouts - retry failed tests up to 3 times
    this.retries(3);

    describe("Mint", function () {
      it("Should stake WETH in Curve guage via metapool", async function () {
        const fixture = await loadFixture(convexOETHMetaVaultFixture);
        const { josh, weth } = fixture;
        await mintTest(fixture, josh, weth, "5");
      });
    });
  }
);

async function mintTest(fixture, user, asset, amount = "3") {
  const { oethVault, oeth, weth, ConvexEthMetaStrategy, cvxRewardPool } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);

  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);

  await asset.connect(user).approve(oethVault.address, unitAmount)
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  console.error((await oeth.balanceOf(user.address)).toString() )
}

// 
// async function mintTest(fixture, user, asset, amount = "30000") {
//   const { vault, ousd, usdt, usdc, dai, OUSDmetaStrategy, cvxRewardPool } =
//     fixture;
// 
//   await vault.connect(user).allocate();
//   await vault.connect(user).rebase();
// 
//   const unitAmount = await units(amount, asset);
// 
//   const currentSupply = await ousd.totalSupply();
//   const currentBalance = await ousd.connect(user).balanceOf(user.address);
//   const currentRewardPoolBalance = await cvxRewardPool
//     .connect(user)
//     .balanceOf(OUSDmetaStrategy.address);
// 
//   // Mint OUSD w/ asset
//   await vault.connect(user).mint(asset.address, unitAmount, 0);
//   await vault.connect(user).allocate();
// 
//   // Ensure user has correct balance (w/ 1% slippage tolerance)
//   const newBalance = await ousd.connect(user).balanceOf(user.address);
//   const balanceDiff = newBalance.sub(currentBalance);
//   expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);
// 
//   // Supply checks
//   const newSupply = await ousd.totalSupply();
//   const supplyDiff = newSupply.sub(currentSupply);
//   const ousdUnitAmount = ousdUnits(amount);
// 
//   // The pool is titled to 3CRV by a million
//   if ([usdt.address, usdc.address].includes(asset.address)) {
//     // It should have added amount*3 supply
//     // (in case of USDT/USDC)
//     expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount.mul(3), 5);
//   } else {
//     // 1x for DAI
//     expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);
//   }
// 
//   // Ensure some LP tokens got staked under OUSDMetaStrategy address
//   const newRewardPoolBalance = await cvxRewardPool
//     .connect(user)
//     .balanceOf(OUSDmetaStrategy.address);
//   const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
//     currentRewardPoolBalance
//   );
//   if (asset.address === dai.address) {
//     // Should not have staked when minted with DAI
//     expect(rewardPoolBalanceDiff).to.equal("0");
//   } else {
//     // Should have staked the LP tokens for USDT and USDC
//     expect(rewardPoolBalanceDiff).to.be.gte(ousdUnits(amount).mul(3).div(2));
//   }
// }
