const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, ousdUnits, forkOnlyDescribe } = require("../helpers");
const { BigNumber } = require("ethers");
const {
  balancerWstEthWethFixture,
  impersonateAndFundContract,
} = require("../_fixture");

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool stWeth/WETH Strategy",
  function () {
    this.timeout(0);
    // due to hardhat forked mode timeouts - retry failed tests up to 3 times
    // this.retries(3);

    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(balancerWstEthWethFixture);
    });

    describe.only("Mint", function () {
      it("Should deploy WETH in Balancer MetaStablePool strategy", async function () {
        const { josh, weth, stETH } = fixture;
        await mintTest(fixture, josh, weth, "30", [weth, stETH]);
      });

      it("Should deploy stETH in Balancer MetaStablePool strategy", async function () {
        const { josh, stETH, weth } = fixture;
        await mintTest(fixture, josh, stETH, "30", [weth, stETH]);
      });

      it("Should have the correct initial maxDepositSlippage state", async function () {
        const { balancerWstEthWethStrategy, josh } = fixture;
        expect(
          await balancerWstEthWethStrategy.connect(josh).maxDepositSlippage()
        ).to.equal(ousdUnits("0.001"));
      });

      it("Should be able to deposit with higher deposit slippage", async function () {});

      it("Should revert when read-only re-entrancy is triggered", async function () {
        /* - needs to be an asset default strategy
         * - needs pool that supports native ETH
         * - attacker needs to try to deposit to balancer pool and withdraw
         * - while withdrawing and receiving ETH attacker should take over the execution flow
         *   and try calling mint/redeem with the strategy default asset on the OethVault
         * - transaction should revert because of the `whenNotInVaultContext` modifier
         */
      });
    });

    describe.only("Withdraw", function () {
      it("Should be able to withdraw some amount of pool liquidity", async function () {
        const { josh, weth, stETH, balancerWstEthWethStrategy, oethVault } =
          fixture;
        await mintTest(fixture, josh, weth, "30", [weth, stETH]);

        const wethBalanceBeforeVault = await weth.balanceOf(oethVault.address);
        const wethToWithdraw = await units("10", weth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerWstEthWethStrategy
          .connect(oethVaultSigner)
          .withdraw(oethVault.address, weth.address, wethToWithdraw);

        const wethBalanceDiffVault = (
          await weth.balanceOf(oethVault.address)
        ).sub(wethBalanceBeforeVault);
        expect(wethBalanceDiffVault).to.approxEqualTolerance(wethToWithdraw, 1);
      });

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { josh, weth, stETH, balancerWstEthWethStrategy, oethVault } =
          fixture;
        await mintTest(fixture, josh, weth, "30", [weth, stETH]);

        const wethBalanceBefore = await balancerWstEthWethStrategy.checkBalance(
          weth.address
        );
        const stEthBalanceBefore =
          await balancerWstEthWethStrategy.checkBalance(stETH.address);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerWstEthWethStrategy.connect(oethVaultSigner).withdrawAll();

        const wethBalanceDiff = wethBalanceBefore.sub(
          await balancerWstEthWethStrategy.checkBalance(weth.address)
        );
        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerWstEthWethStrategy.checkBalance(stETH.address)
        );

        expect(wethBalanceDiff).to.be.gte(await units("15", weth), 1);
        expect(stEthBalanceDiff).to.be.gte(await units("15", stETH), 1);
      });

      it("Should have the correct initial maxWithdrawalSlippage state", async function () {
        const { balancerWstEthWethStrategy, josh } = fixture;
        expect(
          await balancerWstEthWethStrategy.connect(josh).maxWithdrawalSlippage()
        ).to.equal(ousdUnits("0.001"));
      });

      it("Should be able to withdraw with higher withdrawal slippage", async function () {});
    });

    describe.only("Harvest rewards", function () {
      it("Should be able to collect reward tokens", async function () {
        const { josh, balancerWstEthWethStrategy, oethHarvester } = fixture;

        await oethHarvester.connect(josh)[
          // eslint-disable-next-line
          "harvestAndSwap(address)"
        ](balancerWstEthWethStrategy.address);
      });
    });
  }
);

async function getPoolBalance(strategy, allAssets) {
  let currentBalancerBalance = BigNumber.from(0);

  for (const asset of allAssets) {
    currentBalancerBalance = currentBalancerBalance.add(
      await strategy.checkBalance(asset.address)
    );
  }

  return currentBalancerBalance;
}

async function mintTest(fixture, user, asset, amount, allAssets) {
  const { oethVault, oeth, balancerWstEthWethStrategy } = fixture;

  await oethVault.connect(user).allocate();
  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentBalancerBalance = await getPoolBalance(
    balancerWstEthWethStrategy,
    allAssets
  );

  // Mint OETH w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newBalancerBalance = await getPoolBalance(
    balancerWstEthWethStrategy,
    allAssets
  );

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const ousdUnitAmount = ousdUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);

  const balancerLiquidityDiff = newBalancerBalance.sub(currentBalancerBalance);

  // Should have liquidity in Balancer
  expect(balancerLiquidityDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}
