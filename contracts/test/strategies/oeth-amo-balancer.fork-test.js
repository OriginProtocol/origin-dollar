const { expect } = require("chai");
const { run } = require("hardhat");

const { units, ousdUnits, isCI } = require("../helpers");
const { createFixtureLoader, balancerOethWethFixture } = require("../fixture/_fixture");
const log = require("../../utils/logger")("test:fork:oeth:amo:balancer");

describe.only("ForkTest: Balancer OETH/WETH AMO Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(balancerOethWethFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    describe("Mint", function () {
      it("Should stake USDT in Curve gauge via metapool", async function () {
        const { josh, weth } = fixture;
        await mintTest(fixture, josh, weth, "100000");
      });

//       it("Should stake USDC in Curve gauge via metapool", async function () {
//         const { matt, usdc } = fixture;
//         await mintTest(fixture, matt, usdc, "120000");
//       });
// 
//       it("Should stake DAI in Curve gauge via metapool", async function () {
//         const { anna, dai } = fixture;
//         await mintTest(fixture, anna, dai, "110000");
//       });
    });

//     describe("Redeem", function () {
//       it("Should redeem", async () => {
//         const { vault, ousd, usdt, usdc, dai, anna, convexOusdAMOStrategy } =
//           fixture;
// 
//         await vault.connect(anna).allocate();
// 
//         const supplyBeforeMint = await ousd.totalSupply();
// 
//         const amount = "10000";
// 
//         const beforeMintBlock = await ethers.provider.getBlockNumber();
// 
//         // Mint with all three assets
//         for (const asset of [usdt, usdc, dai]) {
//           await vault
//             .connect(anna)
//             .mint(asset.address, await units(amount, asset), 0);
//         }
// 
//         await vault.connect(anna).allocate();
// 
//         log("After mints and allocate to strategy");
//         await run("amoStrat", {
//           pool: "OUSD",
//           output: false,
//           fromBlock: beforeMintBlock,
//         });
// 
//         const afterMintBlock = await ethers.provider.getBlockNumber();
// 
//         // we multiply it by 3 because 1/3 of balance is represented by each of the assets
//         const strategyBalance = (
//           await convexOusdAMOStrategy.checkBalance(dai.address)
//         ).mul(3);
// 
//         // 3x 10k assets + 3x 10k OUSD = 60k
//         await expect(strategyBalance).to.be.gte(ousdUnits("59990"));
// 
//         // Total supply should be up by at least (10k x 2) + (10k x 2) + 10k = 50k
//         const currentSupply = await ousd.totalSupply();
//         const supplyAdded = currentSupply.sub(supplyBeforeMint);
//         expect(supplyAdded).to.be.gte(ousdUnits("49995"));
// 
//         const currentBalance = await ousd.connect(anna).balanceOf(anna.address);
// 
//         // Now try to redeem the amount
//         const redeemAmount = ousdUnits("29990");
//         await vault.connect(anna).redeem(redeemAmount, 0);
// 
//         log("After redeem");
//         await run("amoStrat", {
//           pool: "OUSD",
//           output: false,
//           fromBlock: afterMintBlock,
//         });
// 
//         // User balance should be down by 30k
//         const newBalance = await ousd.connect(anna).balanceOf(anna.address);
//         expect(newBalance).to.approxEqualTolerance(
//           currentBalance.sub(redeemAmount),
//           1
//         );
// 
//         const newSupply = await ousd.totalSupply();
//         const supplyDiff = currentSupply.sub(newSupply);
//         expect(supplyDiff).to.be.gte(redeemAmount);
//       });
//     });
  });

//   describe("Redeem", function () {
//     it("Should redeem", async () => {
//       const { vault, ousd, usdt, usdc, dai, anna, OUSDmetaStrategy } = fixture;
// 
//       await vault.connect(anna).allocate();
// 
//       const supplyBeforeMint = await ousd.totalSupply();
// 
//       const amount = "10000";
// 
//       // Mint with all three assets
//       for (const asset of [usdt, usdc, dai]) {
//         await vault
//           .connect(anna)
//           .mint(asset.address, await units(amount, asset), 0);
//       }
// 
//       await vault.connect(anna).allocate();
// 
//       // we multiply it by 3 because 1/3 of balance is represented by each of the assets
//       const strategyBalance = (
//         await OUSDmetaStrategy.checkBalance(dai.address)
//       ).mul(3);
// 
//       // min 1x 3crv + 1x printed OUSD: (10k + 10k) * (usdt + usdc) = 40k
//       await expect(strategyBalance).to.be.gte(ousdUnits("40000"));
// 
//       // Total supply should be up by at least (10k x 2) + (10k x 2) + 10k = 50k
//       const currentSupply = await ousd.totalSupply();
//       const supplyAdded = currentSupply.sub(supplyBeforeMint);
//       expect(supplyAdded).to.be.gte(ousdUnits("49995"));
// 
//       const currentBalance = await ousd.connect(anna).balanceOf(anna.address);
// 
//       // Now try to redeem the amount
//       const redeemAmount = ousdUnits("22000");
//       await vault.connect(anna).redeem(redeemAmount, 0);
// 
//       // User balance should be down by 30k
//       const newBalance = await ousd.connect(anna).balanceOf(anna.address);
//       expect(newBalance).to.approxEqualTolerance(
//         currentBalance.sub(redeemAmount),
//         1
//       );
// 
//       const newSupply = await ousd.totalSupply();
//       const supplyDiff = currentSupply.sub(newSupply);
// 
//       expect(supplyDiff).to.be.gte(redeemAmount);
//     });
//   });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { oethVault, ousd, balancerEthAMOStrategy, cvxRewardPool } = fixture;

  await oethVault.connect(user).allocate();
  await oethVault.connect(user).rebase();

  const unitAmount = await units(amount, asset);

  const currentSupply = await ousd.totalSupply();
  const currentBalance = await ousd.connect(user).balanceOf(user.address);
  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(balancerEthAMOStrategy.address);

  // Mint OUSD w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  // Ensure user has correct balance (w/ 1% slippage tolerance)
  const newBalance = await ousd.connect(user).balanceOf(user.address);
  const balanceDiff = newBalance.sub(currentBalance);
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);

  // Supply checks
  const newSupply = await ousd.totalSupply();
  const supplyDiff = newSupply.sub(currentSupply);
  // Ensure 2x OUSD has been added to supply
  expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount).mul(2), 1);

  // Ensure some LP tokens got staked under balancerEthAMOStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(balancerEthAMOStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );
  // Should have staked the LP tokens
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
    ousdUnits(amount).mul(2),
    5
  );
}
