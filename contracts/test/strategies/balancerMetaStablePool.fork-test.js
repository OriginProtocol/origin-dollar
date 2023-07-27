const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const { BigNumber } = require("ethers");
const {
  balancerREthFixture,
  impersonateAndFundContract,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:strategy:balancer");

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool rETH/WETH Strategy",
  function () {
    this.timeout(0);
    // due to hardhat forked mode timeouts - retry failed tests up to 3 times
    // this.retries(3);

    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(balancerREthFixture);
    });

    describe("Mint", function () {
      it("Should deploy WETH in Balancer MetaStablePool strategy", async function () {
        const { josh, weth, reth } = fixture;
        await mintTest(fixture, josh, weth, "10", [weth, reth]);
      });

      it("Should deploy rETH in Balancer MetaStablePool strategy", async function () {
        const { josh, reth, weth } = fixture;
        await mintTest(fixture, josh, reth, "30", [weth, reth]);
      });

      it("Should have the correct initial maxDepositSlippage state", async function () {
        const { balancerREthStrategy, josh } = fixture;
        expect(
          await balancerREthStrategy.connect(josh).maxDepositSlippage()
        ).to.equal(oethUnits("0.001"));
      });

      it("Should be able to deposit with higher deposit slippage", async function () {});

      it("Should revert when read-only re-entrancy is triggered", async function () {
        /* - needs to be an asset default strategy
         * - needs pool that supports native ETH
         * - attacker needs to try to deposit to Balancer pool and withdraw
         * - while withdrawing and receiving ETH attacker should take over the execution flow
         *   and try calling mint/redeem with the strategy default asset on the OethVault
         * - transaction should revert because of the `whenNotInVaultContext` modifier
         */
      });
    });

    describe("Withdraw", function () {
      it("Should be able to withdraw some amount of pool liquidity", async function () {
        const { josh, weth, reth, balancerREthStrategy, oethVault } = fixture;
        await mintTest(fixture, josh, weth, "30", [weth, reth]);

        const wethBalanceBeforeVault = await weth.balanceOf(oethVault.address);
        const wethToWithdraw = await units("10", weth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerREthStrategy
          .connect(oethVaultSigner)
          .withdraw(oethVault.address, weth.address, wethToWithdraw);

        const wethBalanceDiffVault = (
          await weth.balanceOf(oethVault.address)
        ).sub(wethBalanceBeforeVault);
        expect(wethBalanceDiffVault).to.approxEqualTolerance(wethToWithdraw, 1);
      });

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { josh, weth, reth, balancerREthStrategy, oethVault } = fixture;
        await mintTest(fixture, josh, weth, "30", [weth, reth]);

        const wethBalanceBefore = await balancerREthStrategy.checkBalance(
          weth.address
        );
        const stEthBalanceBefore = await balancerREthStrategy.checkBalance(
          reth.address
        );

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerREthStrategy.connect(oethVaultSigner).withdrawAll();

        const wethBalanceDiff = wethBalanceBefore.sub(
          await balancerREthStrategy.checkBalance(weth.address)
        );
        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerREthStrategy.checkBalance(reth.address)
        );

        expect(wethBalanceDiff).to.be.gte(await units("15", weth), 1);
        expect(stEthBalanceDiff).to.be.gte(await units("15", reth), 1);
      });

      it("Should have the correct initial maxWithdrawalSlippage state", async function () {
        const { balancerREthStrategy, josh } = fixture;
        expect(
          await balancerREthStrategy.connect(josh).maxWithdrawalSlippage()
        ).to.equal(oethUnits("0.001"));
      });

      it("Should be able to withdraw with higher withdrawal slippage", async function () {});
    });

    describe("Harvest rewards", function () {
      it("Should be able to collect reward tokens", async function () {
        const { josh, balancerREthStrategy, oethHarvester } = fixture;

        await oethHarvester.connect(josh)[
          // eslint-disable-next-line
          "harvestAndSwap(address)"
        ](balancerREthStrategy.address);
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
  const { oethVault, oeth, balancerREthStrategy } = fixture;

  await oethVault.connect(user).allocate();
  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentBalancerBalance = await getPoolBalance(
    balancerREthStrategy,
    allAssets
  );

  // Mint OETH w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newBalancerBalance = await getPoolBalance(
    balancerREthStrategy,
    allAssets
  );

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(unitAmount, 1);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);

  expect(supplyDiff).to.approxEqualTolerance(unitAmount, 1);

  const balancerLiquidityDiff = newBalancerBalance.sub(currentBalancerBalance);

  // Should have liquidity in Balancer
  expect(balancerLiquidityDiff).to.approxEqualTolerance(unitAmount, 1);

  // Check balance in a transaction so the gas usage can be measured
  await balancerREthStrategy.checkBalance(asset.address);
  const tx = await balancerREthStrategy
    .connect(user)
    .populateTransaction.checkBalance(asset.address);
  await user.sendTransaction(tx);
}
