const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { advanceTime, units, oethUnits, isCI } = require("../helpers");
const { createFixtureLoader, fraxConvexWethFixture } = require("../_fixture");
const addresses = require("../../utils/addresses");
const { resolveAsset } = require("../../utils/assets");
const {
  MAX_UINT256,
  ONE_BYTES32,
  DAY,
  WEEK,
} = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers.js");

const log = require("../../utils/logger")("test:fork:convex:frxETH/WETH");

describe("ForkTest: Frax Convex Strategy for Curve frxETH/WETH pool", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  const supportedAssets = ["WETH", "frxETH"];

  let fixture;

  const convexFrxWethDepositBehaviours = () => {
    supportedAssets.forEach((symbol) => {
      it(`Vault should deposit some ${symbol} to the strategy`, async function () {
        const {
          fraxConvexWethStrategy,
          oeth,
          curveFrxEthWethPool,
          oethVaultSigner,
          frxETH,
          weth,
        } = fixture;

        const asset = await resolveAsset(symbol, fixture);
        const depositAmount = await units("3000", asset);

        const oethSupplyBefore = await oeth.totalSupply();
        const curveBalancesBefore = await curveFrxEthWethPool.get_balances();
        const wethStrategyBalanceBefore =
          await fraxConvexWethStrategy.checkBalance(weth.address);
        const frxEthStrategyBalanceBefore =
          await fraxConvexWethStrategy.checkBalance(frxETH.address);

        // Vault transfers asset to the strategy
        await asset
          .connect(oethVaultSigner)
          .transfer(fraxConvexWethStrategy.address, depositAmount);

        const tx = await fraxConvexWethStrategy
          .connect(oethVaultSigner)
          .deposit(asset.address, depositAmount);

        // Check emitted events
        await expect(tx)
          .to.emit(fraxConvexWethStrategy, "Deposit")
          .withArgs(asset.address, curveFrxEthWethPool.address, depositAmount);

        // Check the WETH balances in the Curve pool
        const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
        const wethBalanceExpected =
          symbol === "WETH"
            ? curveBalancesBefore[0].add(depositAmount)
            : curveBalancesBefore[0];
        expect(curveBalancesAfter[0]).to.approxEqualTolerance(
          wethBalanceExpected,
          0.01 // 0.01% or 1 basis point
        );
        // Check the frxETH balances in the Curve pool has no gone up
        const frxEthBalanceExpected =
          symbol === "frxETH"
            ? curveBalancesBefore[1].add(depositAmount)
            : curveBalancesBefore[1];
        expect(curveBalancesAfter[1]).to.approxEqualTolerance(
          frxEthBalanceExpected,
          0.01
        );

        // Check the OETH total supply has not increased
        const oethSupplyAfter = await oeth.totalSupply();
        expect(oethSupplyAfter).to.approxEqualTolerance(oethSupplyBefore, 0.01);

        // Check both the strategy's asset balances have gone up
        const halfDepositAmount = depositAmount.div(2);
        expect(
          await fraxConvexWethStrategy.checkBalance(weth.address)
        ).to.approxEqualTolerance(
          wethStrategyBalanceBefore.add(halfDepositAmount)
        );
        expect(
          await fraxConvexWethStrategy.checkBalance(frxETH.address)
        ).to.approxEqualTolerance(
          frxEthStrategyBalanceBefore.add(halfDepositAmount)
        );
      });
    });
    it("Should deposit all frxETH and WETH assets to the strategy", async function () {
      const {
        fraxConvexWethStrategy,
        curveFrxEthWethPool,
        oethVaultSigner,
        frxETH,
        weth,
      } = fixture;

      const wethStrategyBalanceBefore =
        await fraxConvexWethStrategy.checkBalance(weth.address);
      const frxEthStrategyBalanceBefore =
        await fraxConvexWethStrategy.checkBalance(frxETH.address);

      const frxEthDepositAmount = parseUnits("4000");
      const wethDepositAmount = parseUnits("5000");
      const totalDepositAmount = frxEthDepositAmount.add(wethDepositAmount);
      await weth
        .connect(oethVaultSigner)
        .transfer(fraxConvexWethStrategy.address, wethDepositAmount);
      await frxETH
        .connect(oethVaultSigner)
        .transfer(fraxConvexWethStrategy.address, frxEthDepositAmount);

      const tx = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .depositAll();

      // Strategy Deposit event for WETH
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Deposit")
        .withArgs(weth.address, curveFrxEthWethPool.address, wethDepositAmount);
      // WETH Transfer event from Curve pool to vault
      await expect(tx).to.emit(weth, "Transfer").withNamedArgs({
        src: fraxConvexWethStrategy.address,
        dst: curveFrxEthWethPool.address,
      });

      // Strategy Deposit event for frxETH
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Deposit")
        .withArgs(
          frxETH.address,
          curveFrxEthWethPool.address,
          frxEthDepositAmount
        );
      // frxETH Transfer event from strategy to vault
      await expect(tx).to.emit(frxETH, "Transfer").withNamedArgs({
        from: fraxConvexWethStrategy.address,
        to: curveFrxEthWethPool.address,
      });

      // Check both the strategy's asset balances have gone up
      // Note the amounts are averaged across both assets as checkBalance
      // is the Curve LP value / 2
      const wethStrategyBalanceAfter =
        await fraxConvexWethStrategy.checkBalance(weth.address);
      expect(wethStrategyBalanceAfter).to.approxEqualTolerance(
        wethStrategyBalanceBefore.add(totalDepositAmount.div(2))
      );
      const frxEthStrategyBalanceAfter =
        await fraxConvexWethStrategy.checkBalance(frxETH.address);
      expect(frxEthStrategyBalanceAfter).to.approxEqualTolerance(
        frxEthStrategyBalanceBefore.add(totalDepositAmount.div(2))
      );
      expect(
        wethStrategyBalanceAfter.add(frxEthStrategyBalanceAfter)
      ).to.approxEqualTolerance(
        wethStrategyBalanceBefore
          .add(frxEthStrategyBalanceBefore)
          .add(totalDepositAmount)
      );
    });
  };

  const convexFrxWethWithdrawBehaviours = () => {
    it("Vault should be able to withdraw all", async () => {
      const {
        fraxConvexWethStrategy,
        curveFrxEthWethPool,
        oeth,
        oethVaultSigner,
        frxETH,
        weth,
      } = fixture;

      // Advance 7 days so the lock has expire
      await advanceTime(7 * 24 * 60 * 60 + 1);

      const oethSupplyBefore = await oeth.totalSupply();

      const {
        wethWithdrawAmount,
        frxEthWithdrawAmount,
        curveBalances: curveBalancesBefore,
      } = await calcWithdrawAllAmounts();

      // Now try to withdraw all the WETH and frxETH from the strategy
      const tx = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      // Check emitted events
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Withdrawal")
        .withArgs(
          weth.address,
          curveFrxEthWethPool.address,
          wethWithdrawAmount
        );
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Withdrawal")
        .withArgs(
          frxETH.address,
          curveFrxEthWethPool.address,
          frxEthWithdrawAmount
        );

      // Check the WETH and frxETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(wethWithdrawAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].sub(frxEthWithdrawAmount),
        0.01 // 0.01%
      );

      // Check the OETH total supply did not decrease
      expect(await oeth.totalSupply()).to.approxEqualTolerance(
        oethSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );
    });
    it("Vault should be able to withdraw some WETH", async () => {
      const {
        fraxConvexWethStrategy,
        oeth,
        curveFrxEthWethPool,
        oethVault,
        oethVaultSigner,
        weth,
      } = fixture;

      // Advance 7 days so the lock has expire
      await advanceTime(7 * 24 * 60 * 60 + 1);

      const wethWithdrawAmount = oethUnits("1000");

      const curveBalancesBefore = await curveFrxEthWethPool.get_balances();
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      // Now try to withdraw the WETH from the strategy
      const tx = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, wethWithdrawAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Withdrawal")
        .withArgs(
          weth.address,
          curveFrxEthWethPool.address,
          wethWithdrawAmount
        );

      // Check the WETH and frxETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(wethWithdrawAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1],
        0.01 // 0.01%
      );

      // Check the OETH total supply hasn't changed much
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the WETH balance in the Vault
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(wethWithdrawAmount)
      );
    });
    [0, 1].forEach((coinIndex) => {
      it(`Should calculate Curve LP tokens for withdrawing coin index ${coinIndex}`, async () => {
        const { curveFrxEthWethPool, fraxConvexWethStrategy, josh } = fixture;
        const coinIndex = 1;
        const withdrawAmount = "1000";
        const withdrawAmountScaled = parseUnits(withdrawAmount);
        const expectedLpAmount =
          await fraxConvexWethStrategy.calcWithdrawLpAmount(
            coinIndex,
            withdrawAmountScaled
          );
        log(`expected LP amount: ${formatUnits(expectedLpAmount)}`);

        const curveGaugeSigner = await impersonateAndFund(
          addresses.mainnet.CurveFrxEthWethGauge
        );
        const amounts = [0, 0];
        amounts[coinIndex] = withdrawAmountScaled;
        const maxLpAmount = withdrawAmountScaled.mul(11).div(10);
        const actualLpAmount = await curveFrxEthWethPool
          .connect(curveGaugeSigner)
          .callStatic["remove_liquidity_imbalance(uint256[2],uint256)"](
            amounts,
            maxLpAmount
          );
        const percDiff = expectedLpAmount
          .sub(actualLpAmount)
          .mul(100000000)
          .div(parseUnits("1"));
        log(
          `actual LP amount  : ${formatUnits(
            actualLpAmount
          )} diff ${formatUnits(percDiff, 4)} bps`
        );
        expect(expectedLpAmount).to.eq(actualLpAmount);

        // This uses a transaction to call a view function so the gas usage can be reported.
        const tx = await fraxConvexWethStrategy
          .connect(josh)
          .populateTransaction.calcWithdrawLpAmount(
            coinIndex,
            withdrawAmountScaled
          );
        await josh.sendTransaction(tx);
      });
    });
  };

  // Calculate the WETH and frxETH amounts from a withdrawAll
  async function calcWithdrawAllAmounts() {
    const {
      fraxConvexWethStrategy,
      curveFrxEthWethPool,
      fraxConvexStakingWeth,
      fraxConvexLockedWeth,
    } = fixture;

    // Get the ETH and OETH balances in the Curve Metapool
    const curveBalances = await curveFrxEthWethPool.get_balances();
    const strategyFraxConvexLpAmount = await fraxConvexStakingWeth.balanceOf(
      fraxConvexWethStrategy.address
    );
    const strategyFraxConvexLpLockedAmount =
      await fraxConvexLockedWeth.lockedLiquidityOf(
        fraxConvexWethStrategy.address
      );
    const strategyLpAmount = strategyFraxConvexLpAmount.add(
      strategyFraxConvexLpLockedAmount
    );
    const totalLpSupply = await curveFrxEthWethPool.totalSupply();

    // WETH to withdraw = WETH pool balance * strategy LP amount / total pool LP amount
    const wethWithdrawAmount = curveBalances[0]
      .mul(strategyLpAmount)
      .div(totalLpSupply);
    // frxETH to burn = frxETH pool balance * strategy LP amount / total pool LP amount
    const frxEthWithdrawAmount = curveBalances[1]
      .mul(strategyLpAmount)
      .div(totalLpSupply);

    log(`WETH withdraw amount : ${formatUnits(wethWithdrawAmount)}`);
    log(`ETH withdraw amount  : ${formatUnits(frxEthWithdrawAmount)}`);

    return { wethWithdrawAmount, frxEthWithdrawAmount, curveBalances };
  }

  async function assertUnlock(tx, lockKey, unlockAmount, unlockTimestamp) {
    const {
      fraxConvexWethStrategy,
      fraxConvexStakingWeth,
      fraxConvexLockedWeth,
    } = fixture;

    await expect(tx)
      .to.emit(fraxConvexWethStrategy, "Unlock")
      .withArgs(lockKey, unlockAmount, unlockTimestamp);

    // Check transfer of staked tokens from the locking contract back to strategy
    await expect(tx)
      .to.emit(fraxConvexStakingWeth, "Transfer")
      .withArgs(
        fraxConvexLockedWeth.address,
        fraxConvexWethStrategy.address,
        unlockAmount
      );
  }

  async function assertNoUnlock(tx) {
    const { fraxConvexWethStrategy } = fixture;

    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Unlock");
  }

  async function assertNoLock(tx, unlockTimestamp = 0) {
    const { fraxConvexWethStrategy, fraxConvexLockedWeth } = fixture;

    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");

    expect(await fraxConvexWethStrategy.lockKey()).to.equal(ONE_BYTES32);
    expect(
      await fraxConvexLockedWeth.lockedLiquidityOf(
        fraxConvexWethStrategy.address
      )
    ).to.equal(0);
    expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(
      unlockTimestamp
    );
  }

  /**
   *
   * @param {BigNumber} expectedLockedBalance
   * @param {number} unlockTimestamp
   */
  async function assertLock(expectedLockedBalance, unlockTimestamp) {
    const { fraxConvexWethStrategy, fraxConvexLockedWeth } = fixture;

    // create new lock with target locked balance
    expect(
      await fraxConvexLockedWeth.lockedLiquidityOf(
        fraxConvexWethStrategy.address
      )
    ).to.equal(expectedLockedBalance);
    expect(await fraxConvexWethStrategy.lockKey()).to.not.equal(ONE_BYTES32);

    // How many locks has there been?
    const lockedStatesLength = await fraxConvexLockedWeth.lockedStakesOfLength(
      fraxConvexWethStrategy.address
    );
    // Get the state of the last lock
    const lockState = await fraxConvexLockedWeth.lockedStakes(
      fraxConvexWethStrategy.address,
      lockedStatesLength - 1
    );
    const currentTime = (await hre.ethers.provider.getBlock("latest"))
      .timestamp;
    // Check end timestamp of the last lock
    expect(lockState.ending_timestamp).to.eq(
      unlockTimestamp || WEEK.add(currentTime).add(1)
    );
    expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(
      unlockTimestamp || WEEK.add(currentTime).add(1)
    );
  }

  /**
   * Check deposit to strategy adds to staked amount and does not change locked amounts
   * @param {BigNumber} depositAmount Amount to deposit with 18 decimals
   * @param {{all: boolean, unlockTimestamp: number}} options
   */
  async function assertDeposit(depositAmount, options = {}) {
    const {
      fraxConvexWethStrategy,
      fraxConvexStakingWeth,
      fraxConvexLockedWeth,
      frxETH,
      josh,
      oethVaultSigner,
    } = fixture;

    const stakedAmountBefore = await fraxConvexStakingWeth.balanceOf(
      fraxConvexWethStrategy.address
    );
    const lockedAmountBefore = await fraxConvexLockedWeth.lockedLiquidityOf(
      fraxConvexWethStrategy.address
    );

    // transfer some frxETH to the strategy so it can be deposited
    await frxETH
      .connect(josh)
      .transfer(fraxConvexWethStrategy.address, depositAmount);

    // Vault calls depositAll or deposit on strategy
    const tx = options.all
      ? await fraxConvexWethStrategy.connect(oethVaultSigner).depositAll()
      : await fraxConvexWethStrategy
          .connect(oethVaultSigner)
          .deposit(frxETH.address, depositAmount);

    // add deposit to existing staked amount
    expect(
      await fraxConvexStakingWeth.balanceOf(fraxConvexWethStrategy.address)
    ).to.approxEqualTolerance(stakedAmountBefore.add(depositAmount));

    // no change to locked amounts
    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Unlock");
    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
    expect(
      await fraxConvexLockedWeth.lockedLiquidityOf(
        fraxConvexWethStrategy.address
      )
    ).to.eq(lockedAmountBefore);

    if (!options.unlockTimestamp) {
      expect(await fraxConvexWethStrategy.lockKey()).to.equal(ONE_BYTES32);
      expect(
        await fraxConvexLockedWeth.lockedLiquidityOf(
          fraxConvexWethStrategy.address
        )
      ).to.equal(0);
      expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(0);
    } else {
      expect(await fraxConvexWethStrategy.lockKey()).to.not.equal(ONE_BYTES32);
      expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(
        options.unlockTimestamp
      );
    }
  }

  /**
   * Check depositAll to strategy adds to staked amount and does not change locked amounts
   * @param {BigNumber} depositAmount Amount to deposit with 18 decimals
   * @param {{unlockTimestamp: number}} options
   */
  async function assertDepositAll(depositAmount, options) {
    return assertDeposit(depositAmount, { ...options, all: true });
  }

  async function assertWithdraw(withdrawAssetAmount) {
    const {
      fraxConvexWethStrategy,
      fraxConvexStakingWeth,
      curveFrxEthWethPool,
      frxETH,
      oethVaultSigner,
      oethVault,
    } = fixture;

    const stakedAmountBefore = await fraxConvexStakingWeth.balanceOf(
      fraxConvexWethStrategy.address
    );

    const tx = await fraxConvexWethStrategy
      .connect(oethVaultSigner)
      .withdraw(oethVault.address, frxETH.address, withdrawAssetAmount);

    // new staked amount = old staked amount - withdraw amount
    // Note the withdraw amount is in frxETH while the staked amount is in Staked Curve LP tokens.
    // This is why we are approximating the remaining staked amount to 1%
    expect(
      await fraxConvexStakingWeth.balanceOf(fraxConvexWethStrategy.address)
    ).to.approxEqualTolerance(stakedAmountBefore.sub(withdrawAssetAmount));

    // Parse the Withdrawn event from the logs from the IFraxConvexStaking contract
    const withdrawnTopic =
      fraxConvexStakingWeth.interface.getEventTopic("Withdrawn");
    const receipt = await tx.wait();
    const stakedLogs = receipt.logs.filter(
      (log) => (log.address = fraxConvexStakingWeth.address)
    );
    const withdrawnLog = stakedLogs.find(
      (log) => log.topics.indexOf(withdrawnTopic) >= 0
    );
    expect(withdrawnLog).to.not.be.undefined;
    const withdrawnEvent =
      fraxConvexStakingWeth.interface.parseLog(withdrawnLog);
    const curveLpAmount = withdrawnEvent.args["_amount"];

    // Check staked Frax Convex LP tokens are burnt from the strategy contract
    await expect(tx)
      .to.emit(fraxConvexStakingWeth, "Transfer")
      .withArgs(fraxConvexWethStrategy.address, addresses.zero, curveLpAmount);
    // Check Curve LP tokens transferred to strategy contract
    await expect(tx)
      .to.emit(curveFrxEthWethPool, "Transfer")
      .withArgs(
        fraxConvexStakingWeth.address,
        fraxConvexWethStrategy.address,
        curveLpAmount
      );
    // Check Curve LP tokens burnt from strategy
    await expect(tx)
      .to.emit(curveFrxEthWethPool, "Transfer")
      .withArgs(fraxConvexWethStrategy.address, addresses.zero, curveLpAmount);

    // no change to locked amounts
    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Unlock");
    await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
  }

  async function assertFailedWithdraw(withdrawAmount) {
    const { fraxConvexWethStrategy, frxETH, oethVaultSigner, oethVault } =
      fixture;

    // revert as withdraw amount > staked amount == 0
    await expect(
      fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, frxETH.address, withdrawAmount)
    ).to.be.revertedWith("Not enough unlocked");
  }

  /**
   *
   * @param {BigNumber} withdrawAmount
   * @param {{lockedBalance: BigNumber, unlockTimestamp: number}} options
   */
  async function assertWithdrawAll(withdrawAmount, options) {
    const { fraxConvexWethStrategy, fraxConvexStakingWeth, oethVaultSigner } =
      fixture;

    const tx = await fraxConvexWethStrategy
      .connect(oethVaultSigner)
      .withdrawAll();

    // target locked balance = 0
    expect(await fraxConvexWethStrategy.targetLockedBalance()).to.equal(0);

    // no unlock
    await assertNoUnlock(tx);

    // new lock
    if (!options?.unlockTimestamp) {
      // no add to lock
      await assertNoLock(tx);
    } else {
      // lock exists
      await assertLock(options.lockedBalance, options.unlockTimestamp);
    }

    // Check no staked Frax Convex LP tokens
    expect(
      await fraxConvexStakingWeth.balanceOf(fraxConvexWethStrategy.address)
    ).to.eq(0);

    await assertStakedWithdraw(tx, withdrawAmount);
  }

  async function assertUnlockWithdrawAll(
    lockKey,
    unlockAmount,
    unlockTimestamp,
    withdrawAmount
  ) {
    const { fraxConvexWethStrategy, oethVaultSigner } = fixture;

    const tx = await fraxConvexWethStrategy
      .connect(oethVaultSigner)
      .withdrawAll();

    // target locked balance = 0
    expect(await fraxConvexWethStrategy.targetLockedBalance()).to.equal(0);

    // unlock expired locked amount
    await assertUnlock(tx, lockKey, unlockAmount, unlockTimestamp);

    // withdraw expired locked amount + staked amount
    await assertStakedWithdraw(tx, withdrawAmount);
  }

  async function assertStakedWithdraw(tx, withdrawAmount) {
    const {
      fraxConvexWethStrategy,
      fraxConvexStakingWeth,
      curveFrxEthWethPool,
    } = fixture;

    // No tokens withdrawn
    if (withdrawAmount.eq(0)) {
      // Check staked Frax Convex LP tokens are not burnt from the strategy contract
      await expect(tx)
        .to.not.emit(fraxConvexStakingWeth, "Transfer")
        .withNamedArgs({
          from: fraxConvexWethStrategy.address,
          to: addresses.zero,
        });
      // Check Curve LP tokens not transferred to strategy contract
      await expect(tx)
        .to.not.emit(curveFrxEthWethPool, "Transfer")
        .withNamedArgs({
          from: fraxConvexStakingWeth.address,
          to: fraxConvexWethStrategy.address,
        });
      // Check Curve LP tokens not burnt from strategy
      await expect(tx)
        .to.not.emit(curveFrxEthWethPool, "Transfer")
        .withNamedArgs({
          from: fraxConvexWethStrategy.address,
          to: addresses.zero,
        });
    } else {
      // Check staked Frax Convex LP tokens are burnt from the strategy contract
      await expect(tx)
        .to.emit(fraxConvexStakingWeth, "Transfer")
        .withArgs(
          fraxConvexWethStrategy.address,
          addresses.zero,
          withdrawAmount
        );
      // Check Curve LP tokens transferred to strategy contract
      await expect(tx)
        .to.emit(curveFrxEthWethPool, "Transfer")
        .withArgs(
          fraxConvexStakingWeth.address,
          fraxConvexWethStrategy.address,
          withdrawAmount
        );
      // Check Curve LP tokens burnt from strategy
      await expect(tx)
        .to.emit(curveFrxEthWethPool, "Transfer")
        .withArgs(
          fraxConvexWethStrategy.address,
          addresses.zero,
          withdrawAmount
        );
    }
  }

  async function getStrategyBalances() {
    const { fraxConvexWethStrategy, frxETH, weth } = fixture;

    return {
      frxETH: await fraxConvexWethStrategy.checkBalance(frxETH.address),
      weth: await fraxConvexWethStrategy.checkBalance(weth.address),
    };
  }

  async function assertStrategyBalances(balancesExpected) {
    const balancesAfter = await getStrategyBalances();
    expect(balancesAfter.frxETH).to.equal(balancesExpected.frxETH);
    expect(balancesAfter.weth).to.equal(balancesExpected.weth);
  }

  async function setTargetLockedBalance(targetLockedBalance) {
    {
      const { strategist, fraxConvexWethStrategy } = fixture;
      await fraxConvexWethStrategy
        .connect(strategist)
        .setTargetLockedBalance(targetLockedBalance);
    }
  }

  describe("with mainnet data", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { fraxConvexWethStrategy } = fixture;

      // Constants
      expect(await fraxConvexWethStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );

      // Immutables
      expect(await fraxConvexWethStrategy.platformAddress()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
      expect(await fraxConvexWethStrategy.vaultAddress()).to.equal(
        addresses.mainnet.OETHVaultProxy
      );
      expect(await fraxConvexWethStrategy.harvesterAddress()).to.equal(
        addresses.mainnet.OETHHarvesterProxy
      );
      // Coins
      expect(await fraxConvexWethStrategy.coin0()).to.equal(
        addresses.mainnet.WETH
      );
      expect(await fraxConvexWethStrategy.coin1()).to.equal(
        addresses.mainnet.frxETH
      );
      expect(await fraxConvexWethStrategy.coin2()).to.equal(addresses.zero);
      // Decimals
      expect(await fraxConvexWethStrategy.decimals0()).to.equal(18);
      expect(await fraxConvexWethStrategy.decimals1()).to.equal(18);
      expect(await fraxConvexWethStrategy.decimals2()).to.equal(0);
      // Curve pool
      expect(await fraxConvexWethStrategy.CURVE_POOL_ASSETS_COUNT()).to.equal(
        2
      );
      expect(await fraxConvexWethStrategy.CURVE_POOL()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
      expect(await fraxConvexWethStrategy.CURVE_LP_TOKEN()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
      // Frax pool
      expect(await fraxConvexWethStrategy.fraxStaking()).to.equal(
        addresses.mainnet.FraxStakedConvexWeth
      );
      expect(await fraxConvexWethStrategy.fraxLocking()).to.equal(
        addresses.mainnet.LockedFraxStakedConvexWeth
      );
      expect(await fraxConvexWethStrategy.targetLockedBalance()).to.equal(0);
      expect(await fraxConvexWethStrategy.lockKey()).to.equal(ONE_BYTES32);
      expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(0);

      // Storage slots
      // Rewards
      expect(await fraxConvexWethStrategy.rewardTokenAddresses(0)).to.equal(
        addresses.mainnet.CRV
      );
      expect(await fraxConvexWethStrategy.rewardTokenAddresses(1)).to.equal(
        addresses.mainnet.CVX
      );
      expect(await fraxConvexWethStrategy.rewardTokenAddresses(2)).to.equal(
        addresses.mainnet.FXS
      );
      // assets to platform address
      expect(
        await fraxConvexWethStrategy.assetToPToken(addresses.mainnet.WETH)
      ).to.equal(addresses.mainnet.CurveFrxEthWethPool);
      expect(
        await fraxConvexWethStrategy.assetToPToken(addresses.mainnet.frxETH)
      ).to.equal(addresses.mainnet.CurveFrxEthWethPool);
    });
    supportedAssets.forEach((symbol) => {
      it(`Should be able to check the ${symbol} balance`, async () => {
        const { fraxConvexWethStrategy } = fixture;
        const asset = await resolveAsset(symbol, fixture);
        expect(await fraxConvexWethStrategy.checkBalance(asset.address)).gte(0);
      });
      it(`${symbol} should be supported`, async () => {
        const { fraxConvexWethStrategy } = fixture;
        const asset = await resolveAsset(symbol, fixture);
        expect(await fraxConvexWethStrategy.supportsAsset(asset.address)).to.be
          .true;
      });
    });
    it("Should be able to re-approve tokens by Governor", async () => {
      const {
        curveFrxEthWethPool,
        fraxConvexWethStrategy,
        fraxConvexStakingWeth,
        frxETH,
        weth,
        timelock,
      } = fixture;
      await fraxConvexWethStrategy.connect(timelock).safeApproveAllTokens();

      // Strategy approves the Curve pool to transfer frxETH
      expect(
        await frxETH.allowance(
          fraxConvexWethStrategy.address,
          addresses.mainnet.CurveFrxEthWethPool
        )
      ).to.eq(MAX_UINT256);
      // Strategy approves the Curve pool to transfer WETH
      expect(
        await weth.allowance(
          fraxConvexWethStrategy.address,
          addresses.mainnet.CurveFrxEthWethPool
        )
      ).to.eq(MAX_UINT256);

      // Strategy approves Frax Staked Convex to transfer Curve pool LP tokens
      expect(
        await curveFrxEthWethPool.allowance(
          fraxConvexWethStrategy.address,
          addresses.mainnet.FraxStakedConvexWeth
        )
      ).to.eq(MAX_UINT256);

      // Strategy approves Frax locking contract to transfer Frax Staked Convex LP tokens
      expect(
        await fraxConvexStakingWeth.allowance(
          fraxConvexWethStrategy.address,
          addresses.mainnet.LockedFraxStakedConvexWeth
        )
      ).to.eq(MAX_UINT256);

      // Run a second time
      await fraxConvexWethStrategy.connect(timelock).safeApproveAllTokens();
    });
  });

  describe("with no assets in the vault", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should be able to collect the rewards by Harvester", async function () {
      const {
        josh,
        oethHarvester,
        oethVaultSigner,
        strategist,
        timelock,
        fraxConvexWethStrategy,
      } = fixture;

      const harvesterSigner = await impersonateAndFund(oethHarvester.address);
      await fraxConvexWethStrategy
        .connect(harvesterSigner)
        .collectRewardTokens();

      for (const signer of [josh, strategist, timelock, oethVaultSigner]) {
        const tx = fraxConvexWethStrategy.connect(signer).collectRewardTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Harvester");
      }
    });
    it.skip("Should be able to harvest the rewards", async function () {
      const {
        josh,
        weth,
        oethHarvester,
        oethDripper,
        oethVault,
        fraxConvexWethStrategy,
        fxs,
      } = fixture;

      // send some CRV to the strategy to partly simulate reward harvesting
      await fxs
        .connect(josh)
        .transfer(fraxConvexWethStrategy.address, parseUnits("10000"));

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // prettier-ignore
      await oethHarvester
          .connect(josh)["harvestAndSwap(address)"](fraxConvexWethStrategy.address);

      const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
        wethBefore
      );
      await oethVault.connect(josh).rebase();

      await expect(wethDiff).to.be.gte(parseUnits("0.2"));
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        timelock,
        strategist,
        josh,
        oethVaultSigner,
        fraxConvexWethStrategy,
        frxETH,
        weth,
        curveFrxEthWethPool,
      } = fixture;

      // Governor can approve all tokens
      const tx = await fraxConvexWethStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(weth, "Approval");
      await expect(tx).to.emit(frxETH, "Approval");
      await expect(tx).to.emit(curveFrxEthWethPool, "Approval");

      for (const signer of [strategist, josh, oethVaultSigner]) {
        const tx = fraxConvexWethStrategy
          .connect(signer)
          .safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
    it("Only Strategist can set target locked balance", async () => {
      const {
        timelock,
        strategist,
        anna,
        josh,
        oethVaultSigner,
        fraxConvexWethStrategy,
      } = fixture;

      // Strategist sets target locked balance
      const targetBalance = parseUnits("1234");
      const tx = await fraxConvexWethStrategy
        .connect(strategist)
        .setTargetLockedBalance(targetBalance);
      await expect(tx).to.emit(
        fraxConvexWethStrategy,
        "TargetLockedBalanceUpdated"
      );
      expect(await fraxConvexWethStrategy.targetLockedBalance()).to.equal(
        targetBalance
      );

      for (const signer of [timelock, anna, josh, oethVaultSigner]) {
        const tx = fraxConvexWethStrategy
          .connect(signer)
          .setTargetLockedBalance(targetBalance);
        await expect(tx).to.be.revertedWith("Caller is not the Strategist");
      }
    });
    it("Should allow anyone to update the lock", async () => {
      const {
        timelock,
        strategist,
        anna,
        josh,
        oethVaultSigner,
        fraxConvexWethStrategy,
      } = fixture;

      for (const signer of [
        timelock,
        strategist,
        anna,
        josh,
        oethVaultSigner,
      ]) {
        // Just check anyone can call.
        // Checks on the unlocking and locking are done in other tests.
        await fraxConvexWethStrategy.connect(signer).updateLock();
      }
    });
  });

  describe("with some WETH and frxETH in the vault", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      wethMintAmount: 5000,
      frxEthMintAmount: 4000,
      depositToStrategy: false,
      fundFXS: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    convexFrxWethDepositBehaviours();
    it("Only vault can deposit all frxETH and WETH assets to the strategy", async function () {
      const {
        fraxConvexWethStrategy,
        curveFrxEthWethPool,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        frxETH,
        weth,
      } = fixture;

      const wethDepositAmount = parseUnits("5000");
      const frxEthDepositAmount = parseUnits("4000");
      await weth
        .connect(oethVaultSigner)
        .transfer(fraxConvexWethStrategy.address, wethDepositAmount);
      await frxETH
        .connect(oethVaultSigner)
        .transfer(fraxConvexWethStrategy.address, frxEthDepositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = fraxConvexWethStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .depositAll();

      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Deposit")
        .withArgs(weth.address, curveFrxEthWethPool.address, wethDepositAmount);
      await expect(tx)
        .to.emit(fraxConvexWethStrategy, "Deposit")
        .withArgs(
          frxETH.address,
          curveFrxEthWethPool.address,
          frxEthDepositAmount
        );
    });
    it("Only vault and governor can withdraw all", async function () {
      const {
        fraxConvexWethStrategy,
        strategist,
        timelock,
        josh,
        oethVaultSigner,
      } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = fraxConvexWethStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      await fraxConvexWethStrategy.connect(timelock).withdrawAll();
      // Vault can withdraw all event with no assets in the strategy
      await fraxConvexWethStrategy.connect(oethVaultSigner).withdrawAll();
    });

    describe("with no locked amounts", () => {
      beforeEach(async () => {
        const { fraxConvexWethStrategy, fraxConvexLockedWeth } = fixture;
        // Check no locks
        expect(
          await fraxConvexLockedWeth.lockedLiquidityOf(
            fraxConvexWethStrategy.address
          )
        ).to.equal(0);
        expect(await fraxConvexWethStrategy.lockKey()).to.equal(ONE_BYTES32);
        expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(0);
      });
      describe("with no staked amount", () => {
        beforeEach(async () => {
          const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;
          // Check no staked amount
          expect(
            await fraxConvexStakingWeth.balanceOf(
              fraxConvexWethStrategy.address
            )
          ).to.equal(0);
        });
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // no add to lock
            await assertNoLock(tx);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1000"));
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("2000"));
          });
          it("should fail withdraw staked amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // no unlock
            // no add to lock
            // no withdraw
            await assertWithdrawAll(parseUnits("0"));
          });
        });
        describe("with target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(parseUnits("1000"));
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // no add to lock
            await assertNoLock(tx);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1000"));
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("2000"));
          });
          it("should fail withdraw staked amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // no unlock
            // no add to lock
            // no withdraw
            await assertWithdrawAll(parseUnits("0"));
          });
        });
      });
      describe("with tiny staked amount", () => {
        beforeEach(async () => {
          const {
            fraxConvexWethStrategy,
            fraxConvexStakingWeth,
            frxETH,
            oethVaultSigner,
            strategist,
          } = fixture;

          // transfer a small amount for a staked amount
          const frxEthDepositAmount = parseUnits("0.05");
          await frxETH.transfer(
            fraxConvexWethStrategy.address,
            frxEthDepositAmount
          );
          await fraxConvexWethStrategy.connect(oethVaultSigner).depositAll();

          // Check actual staked amount
          expect(
            await fraxConvexStakingWeth.balanceOf(
              fraxConvexWethStrategy.address
            )
          ).to.approxEqualTolerance(frxEthDepositAmount);

          await fraxConvexWethStrategy
            .connect(strategist)
            .setTargetLockedBalance(parseUnits("1000"));
        });
        it("should not lock small staked amount", async () => {
          const { fraxConvexWethStrategy } = fixture;

          const tx = await fraxConvexWethStrategy.updateLock();

          // no unlock
          await assertNoUnlock(tx);
          // no lock as staked amount is too small
          await assertNoLock(tx);
        });
      });
    });
  });

  describe("with some WETH and frxETH deployed to the strategy", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      wethMintAmount: 5000,
      frxEthMintAmount: 4000,
      depositToStrategy: true,
      fundFXS: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
      const { frxETH, weth, josh, oethVault } = fixture;
      await mint(frxETH, "4000", josh, oethVault);
      await mint(weth, "5000", josh, oethVault);
    });
    it("Should not check balance of unsupported assets", async () => {
      const { fraxConvexWethStrategy, oeth, stETH, reth, dai, usdc } = fixture;

      for (const asset of [oeth, stETH, reth, dai, usdc]) {
        await expect(
          fraxConvexWethStrategy.checkBalance(asset.address)
        ).to.revertedWith("Unsupported asset");
      }
    });
    it("Only vault can withdraw some WETH or frxETH from the strategy", async function () {
      const {
        fraxConvexWethStrategy,
        curveFrxEthWethPool,
        oethVault,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        frxETH,
        weth,
      } = fixture;

      // Advance 7 days so the lock has expired
      await advanceTime(7 * 24 * 60 * 60 + 1);

      // Withdraw WETH from the strategy
      const tx1 = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, parseUnits("50"));

      // strategy Withdrawal event for WETH
      await expect(tx1).to.emit(fraxConvexWethStrategy, "Withdrawal");
      // WETH Transfer event from Curve pool to vault
      await expect(tx1).to.emit(weth, "Transfer").withNamedArgs({
        src: curveFrxEthWethPool.address,
        dst: oethVault.address,
      });

      // Withdraw frxETH from the strategy
      const tx2 = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, frxETH.address, parseUnits("50"));

      // strategy Withdrawal event for frxETH
      await expect(tx2).to.emit(fraxConvexWethStrategy, "Withdrawal");
      // frxETH Transfer event from Curve pool to vault
      await expect(tx2).to.emit(frxETH, "Transfer").withNamedArgs({
        from: curveFrxEthWethPool.address,
        to: oethVault.address,
      });

      // Negative tests
      for (const signer of [strategist, timelock, josh]) {
        const txFail = fraxConvexWethStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(txFail).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all WETH and frxETH from the strategy", async function () {
      const {
        fraxConvexWethStrategy,
        curveFrxEthWethPool,
        strategist,
        timelock,
        josh,
        oethVault,
        oethVaultSigner,
        frxETH,
        weth,
      } = fixture;

      // Advance 7 days so the lock has expired
      await advanceTime(7 * 24 * 60 * 60);

      for (const signer of [strategist, josh]) {
        const tx = fraxConvexWethStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx1 = fraxConvexWethStrategy.connect(timelock).withdrawAll();

      // strategy Withdrawal event for WETH
      await expect(tx1)
        .to.emit(fraxConvexWethStrategy, "Withdrawal")
        .withNamedArgs({
          _asset: weth.address,
          _pToken: curveFrxEthWethPool.address,
        });
      // WETH Transfer event from Curve pool to strategy
      await expect(tx1).to.emit(weth, "Transfer").withNamedArgs({
        src: curveFrxEthWethPool.address,
        dst: fraxConvexWethStrategy.address,
      });
      // WETH Transfer event from strategy to vault
      await expect(tx1).to.emit(weth, "Transfer").withNamedArgs({
        src: fraxConvexWethStrategy.address,
        dst: oethVault.address,
      });

      // strategy Withdrawals event for frxETH
      await expect(tx1)
        .to.emit(fraxConvexWethStrategy, "Withdrawal")
        .withNamedArgs({
          _asset: frxETH.address,
          _pToken: curveFrxEthWethPool.address,
        });
      // frxETH Transfer event from Curve pool to strategy
      await expect(tx1).to.emit(frxETH, "Transfer").withNamedArgs({
        from: curveFrxEthWethPool.address,
        to: fraxConvexWethStrategy.address,
      });
      // frxETH Transfer event from strategy to vault
      await expect(tx1).to.emit(frxETH, "Transfer").withNamedArgs({
        from: fraxConvexWethStrategy.address,
        to: oethVault.address,
      });

      // Vault can withdraw all event with no assets in the strategy
      const tx2 = await fraxConvexWethStrategy
        .connect(oethVaultSigner)
        .withdrawAll();
      await expect(tx2).to.not.emit(fraxConvexWethStrategy, "Withdrawal");
    });
    convexFrxWethDepositBehaviours();
    convexFrxWethWithdrawBehaviours();

    describe("with no locked amounts", () => {
      beforeEach(async () => {
        const { fraxConvexWethStrategy, fraxConvexLockedWeth } = fixture;
        // Check no locks
        expect(
          await fraxConvexLockedWeth.lockedLiquidityOf(
            fraxConvexWethStrategy.address
          )
        ).to.equal(0);
        expect(await fraxConvexWethStrategy.lockKey()).to.equal(ONE_BYTES32);
        expect(await fraxConvexWethStrategy.unlockTimestamp()).to.equal(0);
      });
      describe("with staked amount", () => {
        let stakedAmount;
        beforeEach(async () => {
          const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;
          // Check staked amount
          stakedAmount = await fraxConvexStakingWeth.balanceOf(
            fraxConvexWethStrategy.address
          );
          log(`Staked amount ${formatUnits(stakedAmount)}`);
          expect(stakedAmount).to.approxEqualTolerance(parseUnits("8990"));
        });
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // no add to lock
            await assertNoLock(tx);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1100"));
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("1200"));
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            await assertWithdraw(parseUnits("8000"));
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            await assertFailedWithdraw(parseUnits("10000"));
          });
          it("should withdraw all", async () => {
            // no unlock
            // no add to lock
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount);
          });
        });
        describe("with 0 < target locked balance < staked amount", () => {
          const targetLockedBalance = parseUnits("2000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(targetLockedBalance).to.lt(stakedAmount);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // create new lock with target locked balance
            await assertLock(targetLockedBalance);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1100"));
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("1200"));
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            await assertWithdraw(parseUnits("8000"));
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            await assertFailedWithdraw(parseUnits("10000"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount);
          });
        });
        describe("with staked amount < target locked balance", () => {
          const targetLockedBalance = parseUnits("12345");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(stakedAmount).to.lt(targetLockedBalance);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // create new lock with staked amount
            await assertLock(stakedAmount);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1100"));
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked
            await assertDepositAll(parseUnits("1200"));
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            await assertWithdraw(parseUnits("8000"));
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            await assertFailedWithdraw(parseUnits("10000"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount);
          });
        });
      });
    });
    describe("with unexpired locked amount", () => {
      let unexpiredAmount;
      let unlockTimestampBefore;
      beforeEach(async () => {
        const { fraxConvexWethStrategy, fraxConvexLockedWeth, strategist } =
          fixture;
        // Lock staked amount
        await setTargetLockedBalance(parseUnits("10000"));
        await fraxConvexWethStrategy.connect(strategist).updateLock();
        unexpiredAmount = await fraxConvexLockedWeth.lockedLiquidityOf(
          fraxConvexWethStrategy.address
        );
        log(`Unexpired locked amount ${formatUnits(unexpiredAmount)}`);
        unlockTimestampBefore = await fraxConvexWethStrategy.unlockTimestamp();
      });
      describe("with no staked amount", () => {
        beforeEach(async () => {
          const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;
          // Check no staked amount
          expect(
            await fraxConvexStakingWeth.balanceOf(
              fraxConvexWethStrategy.address
            )
          ).to.eq(0);
        });
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // lock exists, time extended but no funds added
            await assertLock(unexpiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("22000"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("1111.11"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
            await assertWithdrawAll(parseUnits("0"), {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
        describe("with 0 < target locked balance < unexpired locked amount", () => {
          const targetLockedBalance = parseUnits("3000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(targetLockedBalance).lt(unexpiredAmount);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // lock exists, time extended but no funds added
            await assertLock(unexpiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("333"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("666.66"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw]
            await assertWithdrawAll(parseUnits("0"), {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
        describe("with unexpired locked amount < target locked balance", () => {
          const targetLockedBalance = parseUnits("15000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(unexpiredAmount).lt(targetLockedBalance);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // lock exists, time extended but no funds added
            await assertLock(unexpiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("4444"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("0.001"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
            await assertWithdrawAll(parseUnits("0"), {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
      });
      describe("with staked amount", () => {
        let stakedAmount;
        beforeEach(async () => {
          const {
            frxETH,
            fraxConvexWethStrategy,
            fraxConvexStakingWeth,
            oethVaultSigner,
          } = fixture;
          // transfer some amount for a staked amount
          const frxEthDepositAmount = parseUnits("3000");
          await frxETH.transfer(
            fraxConvexWethStrategy.address,
            frxEthDepositAmount
          );
          await fraxConvexWethStrategy.connect(oethVaultSigner).depositAll();

          // Check staked amount
          stakedAmount = await fraxConvexStakingWeth.balanceOf(
            fraxConvexWethStrategy.address
          );
          log(`Staked amount ${formatUnits(stakedAmount)}`);
          // approximate as we are comparing Curve LP to frxETH
          expect(stakedAmount).to.approxEqualTolerance(frxEthDepositAmount);
        });
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);
            // lock exists, time extended but no funds added
            await assertLock(unexpiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("5555"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("1.23"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2000");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            const withdrawAmount = parseUnits("3300");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount, {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
        describe("with unexpired locked amount < target locked balance < unexpired locked amount + staked amount", () => {
          const targetLockedBalance = parseUnits("11000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(unexpiredAmount).lt(targetLockedBalance);
            expect(targetLockedBalance).lt(unexpiredAmount.add(stakedAmount));
          });
          it("should update lock ", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // add target locked balance - unexpired locked amount to lock
            // lock exists and is now equal to target locked balance
            // with unlock time in one week
            await assertLock(targetLockedBalance);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("2222"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("12.34"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2000");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            const withdrawAmount = parseUnits("3100");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount, {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
        describe("with unexpired locked amount < unexpired locked amount + staked amount < target locked balance", () => {
          const targetLockedBalance = parseUnits("22000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(unexpiredAmount).lt(unexpiredAmount.add(stakedAmount));
            expect(unexpiredAmount.add(stakedAmount)).lt(targetLockedBalance);
          });
          it("should update lock ", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // add staked amount to lock
            // lock exists and is now equal to unexpired amount + staked amount
            // with unlock time in one week
            await assertLock(unexpiredAmount.add(stakedAmount));
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("333.33"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("0.001"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2500");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            const withdrawAmount = parseUnits("4000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount, {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
        describe("with 0 < target locked balance < unexpired locked amount", () => {
          const targetLockedBalance = parseUnits("6000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(targetLockedBalance).lt(unexpiredAmount);
          });
          it("should update lock ", async () => {
            const { fraxConvexWethStrategy } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // lock exists, time extended but no funds added
            await assertLock(unexpiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("11111.11"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("0.001"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("10");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            const withdrawAmount = parseUnits("3000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
            await assertWithdrawAll(stakedAmount, {
              lockedBalance: unexpiredAmount,
              unlockTimestamp: unlockTimestampBefore,
            });
          });
        });
      });
    });
    describe("with expired locked amount", () => {
      let lockKeyBefore;
      let expiredAmount;
      let unlockTimestampBefore;
      beforeEach(async () => {
        const { fraxConvexWethStrategy, fraxConvexLockedWeth, strategist } =
          fixture;
        // Lock staked amount
        await setTargetLockedBalance(parseUnits("10000"));
        await fraxConvexWethStrategy.connect(strategist).updateLock();
        expiredAmount = await fraxConvexLockedWeth.lockedLiquidityOf(
          fraxConvexWethStrategy.address
        );
        log(`Expired locked amount ${formatUnits(expiredAmount)}`);

        lockKeyBefore = await fraxConvexWethStrategy.lockKey();
        unlockTimestampBefore = await fraxConvexWethStrategy.unlockTimestamp();
        log(`unlockTimestampBefore ${unlockTimestampBefore}`);

        // Move ahead in time so the lock expires
        await advanceTime(WEEK.add(DAY));
      });
      it("Should be able to collect the rewards", async function () {
        const { crv, cvx, fxs, oethHarvester, fraxConvexWethStrategy } =
          fixture;

        const harvesterSigner = await impersonateAndFund(oethHarvester.address);
        const tx = await fraxConvexWethStrategy
          .connect(harvesterSigner)
          .collectRewardTokens();

        await expect(tx)
          .to.emit(crv, "Transfer")
          .withNamedArgs({ to: oethHarvester.address });
        await expect(tx)
          .to.emit(cvx, "Transfer")
          .withNamedArgs({ to: oethHarvester.address });
        await expect(tx)
          .to.emit(fxs, "Transfer")
          .withNamedArgs({ to: oethHarvester.address });
      });
      describe("with no staked amount", () => {
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // unlock expired locked amount
            await assertUnlock(
              tx,
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore
            );
            // no new lock
            await assertNoLock(tx, unlockTimestampBefore);

            // staked amount = expired locked amount
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(expiredAmount);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("2222.22"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("1"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount
            );
          });
        });
        describe("with 0 < target locked balance < expired locked amount", () => {
          const targetLockedBalance = parseUnits("1000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(targetLockedBalance).lt(expiredAmount);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // unlock expired locked amount
            await assertUnlock(
              tx,
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore
            );

            // create a new lock for 7 days with target locked balance
            await assertLock(targetLockedBalance);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");

            // staked amount = expired locked amount - target locked balance
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(expiredAmount.sub(targetLockedBalance));
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("4321"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("3"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount
            );
          });
        });
        describe("with expired locked amount < target locked balance", () => {
          const targetLockedBalance = parseUnits("20000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(expiredAmount).lt(targetLockedBalance);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // add 7 days to existing lock
            // locked amount = expired locked amount
            await assertLock(expiredAmount);
            await expect(tx).to.not.emit(fraxConvexWethStrategy, "Lock");

            // staked amount = 0
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(0);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("9999"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("44.44"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount > staked amount == 0
            await assertFailedWithdraw(parseUnits("1"));
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount
            );
          });
        });
      });
      describe("with staked amount", () => {
        let stakedAmount;
        beforeEach(async () => {
          const {
            frxETH,
            fraxConvexWethStrategy,
            fraxConvexStakingWeth,
            oethVaultSigner,
          } = fixture;
          // transfer some amount for a staked amount
          const frxEthDepositAmount = parseUnits("3000");
          await frxETH.transfer(
            fraxConvexWethStrategy.address,
            frxEthDepositAmount
          );
          await fraxConvexWethStrategy.connect(oethVaultSigner).depositAll();

          // Check staked amount
          stakedAmount = await fraxConvexStakingWeth.balanceOf(
            fraxConvexWethStrategy.address
          );
          log(`Staked amount ${formatUnits(stakedAmount)}`);
          // approximate as we are comparing Curve LP to frxETH
          expect(stakedAmount).to.approxEqualTolerance(frxEthDepositAmount);
        });
        describe("with zero target locked balance", () => {
          beforeEach(async () => {
            await setTargetLockedBalance(0);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const balancesBefore = await getStrategyBalances();

            const tx = await fraxConvexWethStrategy.updateLock();

            // unlock expired locked amount
            await assertUnlock(
              tx,
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore
            );

            // no new lock
            await assertNoLock(tx, unlockTimestampBefore);

            // staked amount = expired locked amount + staked amount
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(expiredAmount.add(stakedAmount));

            await assertStrategyBalances(balancesBefore);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("8888.88"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("0.02"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2000");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
            const withdrawAmount = parseUnits("3000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount.add(stakedAmount)
            );
          });
        });
        describe("with 0 < target locked balance < expired locked amount", () => {
          const targetLockedBalance = parseUnits("2000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(targetLockedBalance).lt(expiredAmount);
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const balancesBefore = await getStrategyBalances();

            const tx = await fraxConvexWethStrategy.updateLock();

            // unlock expired locked amount
            await assertUnlock(
              tx,
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore
            );

            // create a new lock for 7 days with target locked balance
            await assertLock(targetLockedBalance);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");

            // new staked amount = expired locked amount - target locked balance + old staked amount
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(
              expiredAmount.sub(targetLockedBalance).add(stakedAmount)
            );

            await assertStrategyBalances(balancesBefore);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("7654.21"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("2"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2000");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked amount
            const withdrawAmount = parseUnits("3000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount.add(stakedAmount)
            );
          });
        });
        describe("with expired locked amount < target locked balance < expired locked amount + staked amount", () => {
          const targetLockedBalance = parseUnits("11000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(expiredAmount).lt(targetLockedBalance);
            expect(targetLockedBalance).lt(expiredAmount.add(stakedAmount));
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const balancesBefore = await getStrategyBalances();

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // add target locked balance - expired locked amount to existing lock
            await assertLock(targetLockedBalance);
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");

            // new staked amount =  old staked amount - (target locked balance - expired locked amount)
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(
              stakedAmount.sub(targetLockedBalance.sub(expiredAmount))
            );

            await assertStrategyBalances(balancesBefore);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("1"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("100.001"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2000");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked amount
            const withdrawAmount = parseUnits("3000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount.add(stakedAmount)
            );
          });
        });
        describe("with expired locked amount < target locked balance > expired locked amount + staked amount", () => {
          const targetLockedBalance = parseUnits("20000");
          beforeEach(async () => {
            await setTargetLockedBalance(targetLockedBalance);
            expect(expiredAmount).lt(targetLockedBalance);
            expect(targetLockedBalance).gt(expiredAmount.add(stakedAmount));
          });
          it("should update lock", async () => {
            const { fraxConvexWethStrategy, fraxConvexStakingWeth } = fixture;

            const tx = await fraxConvexWethStrategy.updateLock();

            // no unlock
            await assertNoUnlock(tx);

            // add staked amount to existing lock
            await assertLock(expiredAmount.add(stakedAmount));
            await expect(tx).to.emit(fraxConvexWethStrategy, "Lock");

            // new staked amount = 0
            expect(
              await fraxConvexStakingWeth.balanceOf(
                fraxConvexWethStrategy.address
              )
            ).to.equal(0);
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDeposit(parseUnits("0.01"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
            await assertDepositAll(parseUnits("5"), {
              unlockTimestamp: unlockTimestampBefore,
            });
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
            const withdrawAmount = parseUnits("2222");
            expect(withdrawAmount).lt(stakedAmount);
            await assertWithdraw(withdrawAmount);
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked amount
            const withdrawAmount = parseUnits("3000");
            expect(withdrawAmount).gt(stakedAmount);
            await assertFailedWithdraw(withdrawAmount);
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
            await assertUnlockWithdrawAll(
              lockKeyBefore,
              expiredAmount,
              unlockTimestampBefore,
              expiredAmount.add(stakedAmount)
            );
          });
        });
      });
    });
  });

  describe("with a lot more WETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      wethMintAmount: 100000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
      const { frxETH, weth, josh, oethVault } = fixture;
      await mint(frxETH, "4000", josh, oethVault);
      await mint(weth, "5000", josh, oethVault);
    });
    convexFrxWethDepositBehaviours();
    convexFrxWethWithdrawBehaviours();
  });

  describe("with a lot more frxETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      frxEthMintAmount: 100000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
      const { frxETH, weth, josh, oethVault } = fixture;
      await mint(frxETH, "4000", josh, oethVault);
      await mint(weth, "5000", josh, oethVault);
    });
    convexFrxWethDepositBehaviours();
    convexFrxWethWithdrawBehaviours();
  });
});

const mint = async (asset, amount, signer, vault) => {
  const amountScaled = units(amount, asset);
  // Approve the Vault to transfer asset
  await asset.connect(signer).approve(vault.address, amountScaled);
  // Mint OToken with asset
  await vault.connect(signer).mint(asset.address, amountScaled, 0);
};
