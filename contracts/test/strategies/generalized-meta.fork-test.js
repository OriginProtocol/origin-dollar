const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { units, ousdUnits, isCI } = require("../helpers");
const {
  createFixtureLoader,
  convexGeneralizedMetaForkedFixture,
} = require("../_fixture");
const {
  tiltToMainToken,
  tiltTo3CRV_Metapool_automatic,
} = require("../_metastrategies-fixtures");
const { impersonateAndFund } = require("../../utils/signers");

const metastrategies = [
  {
    token: "LUSD",
    metapoolAddress: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
    lpTokenAddress: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
    metastrategyProxyName: "ConvexLUSDMetaStrategyProxy",
    rewardPoolAddress: "0x2ad92A7aE036a038ff02B96c88de868ddf3f8190",
    skipMewTest: false,
  },
];

metastrategies.forEach((config) => {
  describe.skip(`ForkTest: Convex 3pool/${config.token} Meta Strategy`, function () {
    this.timeout(0);

    // Retry up to 3 times on CI
    this.retries(isCI ? 3 : 0);

    let fixture;
    const loadFixture = createFixtureLoader(
      convexGeneralizedMetaForkedFixture,
      config
    );
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    describe.skip("", () => {
      describe("Mint", function () {
        it("Should NOT stake DAI in Curve gauge via metapool", async function () {
          const { anna, dai } = fixture;
          await mintTest(fixture, anna, dai, "432000");
        });

        it("Should stake USDT in Curve gauge via metapool", async function () {
          const { josh, usdt } = fixture;
          await mintTest(fixture, josh, usdt, "100000");
        });

        it("Should stake USDC in Curve gauge via metapool", async function () {
          const { matt, usdc } = fixture;
          await mintTest(fixture, matt, usdc, "345000");
        });
      });

      describe("Redeem", function () {
        it("Should redeem", async () => {
          const { vault, ousd, usdt, usdc, anna } = fixture;
          await vault.connect(anna).allocate();
          await vault.connect(anna).rebase();
          const supplyBeforeMint = await ousd.totalSupply();

          const amount = "10000";

          // Mint with all three assets
          for (const asset of [usdt, usdc]) {
            await vault
              .connect(anna)
              .mint(asset.address, await units(amount, asset), 0);
          }
          await vault.connect(anna).allocate();

          const currentSupply = await ousd.totalSupply();
          const supplyAdded = currentSupply.sub(supplyBeforeMint);
          expect(supplyAdded).to.be.gte("20000");

          const currentBalance = await ousd
            .connect(anna)
            .balanceOf(anna.address);

          // Now try to redeem 20k - 1% (possible undervaluation of coins)
          await vault.connect(anna).redeem(ousdUnits("19800"), 0);

          // User balance should be down by 30k - 1%
          const newBalance = await ousd.connect(anna).balanceOf(anna.address);
          expect(currentBalance).to.approxEqualTolerance(
            newBalance.add(ousdUnits("19800")),
            1
          );

          const newSupply = await ousd.totalSupply();
          const supplyDiff = currentSupply.sub(newSupply);

          expect(supplyDiff).to.be.gte(
            ousdUnits("19800").sub(ousdUnits("19800").div(100))
          );
        });
      });

      describe("post deployment", () => {
        it("Should have the correct initial maxWithdrawalSlippage state", async function () {
          const { metaStrategy, anna } = fixture;
          expect(
            await metaStrategy.connect(anna).maxWithdrawalSlippage()
          ).to.equal(ousdUnits("0.01"));
        });
      });

      describe("Withdraw all", function () {
        it("Should not allow withdraw all when MEW tries to manipulate the pool", async function () {
          if (config.skipMewTest) {
            this.skip();
            return;
          }
          const { timelockAddr } = await getNamedAccounts();
          const sGovernor = await ethers.provider.getSigner(timelockAddr);

          const { vault, usdt, anna } = fixture;

          const sVault = await impersonateAndFund(vault.address);

          await vault.connect(anna).allocate();
          await vault.connect(anna).rebase();
          await tiltTo3CRV_Metapool_automatic(fixture);

          await vault
            .connect(anna)
            .mint(usdt.address, await units("30000", usdt), 0);
          await vault.connect(anna).allocate();

          await fixture.metaStrategy
            .connect(sGovernor)
            .setMaxWithdrawalSlippage(ousdUnits("0"));
          await tiltToMainToken(fixture);

          let error = false;
          try {
            await vault
              .connect(sGovernor)
              .withdrawAllFromStrategy(fixture.metaStrategyProxy.address);

            expect.fail("Transaction not reverted");
          } catch (e) {
            error = e.message;
          }

          /* Different implementations of Curve's StableSwap pools fail differently when the
           * the minimum expected token payout threshold is not reached. For that reason we
           * test the revert error against multiple possible values.
           */
          expect(error).to.be.oneOf([
            "Transaction reverted without a reason string",
            "VM Exception while processing transaction: reverted with reason string 'Not enough coins removed'",
          ]);

          // should not revert when slippage tolerance set to 10%
          await fixture.metaStrategy
            .connect(sVault)
            .setMaxWithdrawalSlippage(ousdUnits("0.1"));
          await vault
            .connect(sGovernor)
            .withdrawAllFromStrategy(fixture.metaStrategyProxy.address);
        });

        it("Should successfully withdrawAll even without any changes to maxWithdrawalSlippage", async function () {
          if (config.skipMewTest) {
            this.skip();
            return;
          }
          const { timelockAddr } = await getNamedAccounts();
          const sGovernor = await ethers.provider.getSigner(timelockAddr);

          const { vault, usdt, anna } = fixture;

          await impersonateAndFund(vault.address);

          await vault.connect(anna).allocate();
          await vault.connect(anna).rebase();
          await tiltTo3CRV_Metapool_automatic(fixture);

          await vault
            .connect(anna)
            .mint(usdt.address, await units("30000", usdt), 0);
          await vault.connect(anna).allocate();

          await vault
            .connect(sGovernor)
            .withdrawAllFromStrategy(fixture.metaStrategyProxy.address);
        });
      });
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, dai, rewardPool } = fixture;
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

  if ((await vault.vaultBuffer()).toString() == "1000000000000000000") {
    // If Vault Buffer is 100%, shouldn't deposit anything to strategy
    expect(rewardPoolBalanceDiff).to.equal("0");
  } else if (asset.address === dai.address) {
    // Should not have staked when minted with DAI
    expect(rewardPoolBalanceDiff).to.equal("0");
  } else {
    // Should have staked the LP tokens for USDT and USDC
    expect(rewardPoolBalanceDiff).to.approxEqualTolerance(ousdUnits(amount), 5);
  }
}
