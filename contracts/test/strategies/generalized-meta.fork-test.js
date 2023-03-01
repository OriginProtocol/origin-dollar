const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { loadFixture } = require("ethereum-waffle");
const { units, ousdUnits, forkOnlyDescribe } = require("../helpers");
const { convexGeneralizedMetaForkedFixture } = require("../_fixture");
const {
  tiltToMainToken,
  tiltTo3CRV_Metapool_automatic,
} = require("../_metastrategies-fixtures");

const metastrategies = [
  {
    token: "LUSD",
    metapoolAddress: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
    lpToken: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
    metastrategyProxyName: "ConvexLUSDMetaStrategyProxy",
    rewardPoolAddress: "0x2ad92A7aE036a038ff02B96c88de868ddf3f8190",
    skipMewTest: false,
  },
];

metastrategies.forEach(
  ({
    token,
    metapoolAddress,
    metastrategyProxyName,
    rewardPoolAddress,
    lpToken,
    skipMewTest,
  }) => {
    forkOnlyDescribe(
      `ForkTest: Convex 3pool/${token} Meta Strategy`,
      function () {
        this.timeout(0);
        // due to hardhat forked mode timeouts - retry failed tests up to 3 times
        this.retries(3);
        let fixture;
        beforeEach(async () => {
          fixture = await loadFixture(
            await convexGeneralizedMetaForkedFixture(
              metapoolAddress,
              rewardPoolAddress,
              metastrategyProxyName,
              lpToken
            )
          );
        });

        describe("Mint", function () {
          async function mintTest(user, asset, amount = "30000") {
            const { vault, ousd, dai, rewardPool } = fixture;
            // pre-allocate just in case vault was holding some funds
            await vault.connect(user).allocate();
            await vault.connect(user).rebase();
            const unitAmount = await units(amount, asset);

            const currentSupply = await ousd.totalSupply();
            const currentBalance = await ousd
              .connect(user)
              .balanceOf(user.address);
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
            const { vault, ousd, usdt, usdc, dai, anna } = fixture;
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

            const currentBalance = await ousd
              .connect(anna)
              .balanceOf(anna.address);

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

            expect(supplyDiff).to.be.gte(
              ousdUnits("29700").sub(ousdUnits("29700").div(100))
            );
          });
        });

        it("Should have the correct initial maxWithdrawalSlippage state", async function () {
          const { metaStrategy, anna } = fixture;
          await expect(
            await metaStrategy.connect(anna).maxWithdrawalSlippage()
          ).to.equal(ousdUnits("0.01"));
        });

        describe("Withdraw all", function () {
          it("Should not allow withdraw all when MEW tries to manipulate the pool", async function () {
            if (skipMewTest) {
              this.skip();
              return;
            }
            const { timelockAddr } = await getNamedAccounts();
            const sGovernor = await ethers.provider.getSigner(timelockAddr);

            const { vault, usdt, anna } = fixture;

            await hre.network.provider.request({
              method: "hardhat_setBalance",
              params: [vault.address, "0x1bc16d674ec80000"], // 2 Eth
            });
            await hre.network.provider.request({
              method: "hardhat_impersonateAccount",
              params: [vault.address],
            });

            const sVault = await ethers.provider.getSigner(vault.address);

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
            if (skipMewTest) {
              this.skip();
              return;
            }
            const { timelockAddr } = await getNamedAccounts();
            const sGovernor = await ethers.provider.getSigner(timelockAddr);

            const { vault, usdt, anna } = fixture;

            await hre.network.provider.request({
              method: "hardhat_setBalance",
              params: [vault.address, "0x1bc16d674ec80000"], // 2 Eth
            });
            await hre.network.provider.request({
              method: "hardhat_impersonateAccount",
              params: [vault.address],
            });

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
      }
    );
  }
);
