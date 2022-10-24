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
    token: "alUSD",
    metapoolAddress: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
    lpToken: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
    metastrategyProxyName: "ConvexalUSDMetaStrategyProxy",
    rewardPoolAddress: "0x02E2151D4F351881017ABdF2DD2b51150841d5B3",
    skipMewTest: false,
  },
  {
    token: "mUSD",
    metapoolAddress: "0x8474DdbE98F5aA3179B3B3F5942D724aFcdec9f6",
    lpToken: "0x1aef73d49dedc4b1778d0706583995958dc862e6",
    metastrategyProxyName: "ConvexmUSDMetaStrategyProxy",
    rewardPoolAddress: "0xDBFa6187C79f4fE4Cda20609E75760C5AaE88e52",
    // metapool implementation wont allow tilting of the pools the way this test does it
    // and then withdrawing liquidity
    skipMewTest: false,
  },
  {
    token: "USDD",
    metapoolAddress: "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea",
    lpToken: "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea",
    metastrategyProxyName: "ConvexUSDDMetaStrategyProxy",
    rewardPoolAddress: "0x7D475cc8A5E0416f0e63042547aDB94ca7045A5b",
    skipMewTest: false,
  },
  {
    token: "BUSD",
    metapoolAddress: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
    lpToken: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
    metastrategyProxyName: "ConvexBUSDMetaStrategyProxy",
    rewardPoolAddress: "0xbD223812d360C9587921292D0644D18aDb6a2ad0",
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

        describe("Withdraw all", function () {
          it("Should not allow withdraw all when MEW tries to manipulate the pool", async function () {
            if (skipMewTest) {
              this.skip();
              return;
            }
            const { governorAddr } = await getNamedAccounts();
            const sGovernor = await ethers.provider.getSigner(governorAddr);

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

            expect(error).to.be.oneOf([
              "Transaction reverted without a reason string",
              "VM Exception while processing transaction: reverted with reason string \\'Not enough coins removed\\'",
            ]);

            // should not revert when slippage tolerance set to 10%
            await fixture.metaStrategy
              .connect(sVault)
              .setMaxWithdrawalSlippage(ousdUnits("0.1"));
            await vault
              .connect(sGovernor)
              .withdrawAllFromStrategy(fixture.metaStrategyProxy.address);
          });
        });
      }
    );
  }
);
