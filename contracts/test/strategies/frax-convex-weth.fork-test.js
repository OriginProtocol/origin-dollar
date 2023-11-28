const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { advanceTime, units, oethUnits, isCI } = require("../helpers");
const { createFixtureLoader, fraxConvexWethFixture } = require("../_fixture");
const addresses = require("../../utils/addresses");
const { resolveAsset } = require("../../utils/assets");
const { MAX_UINT256, ZERO_BYTES32 } = require("../../utils/constants");
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
      expect(await fraxConvexWethStrategy.lockKey()).to.equal(ZERO_BYTES32);
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
  });

  describe("with some WETH and frxETH in the vault", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      wethMintAmount: 5000,
      frxEthMintAmount: 4000,
      depositToStrategy: false,
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
  });

  describe("with some WETH and frxETH deployed to the strategy", () => {
    const loadFixture = createFixtureLoader(fraxConvexWethFixture, {
      wethMintAmount: 5000,
      frxEthMintAmount: 4000,
      depositToStrategy: true,
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
      describe("with no staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw staked amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
          });
        });
      });
      describe("with staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
        describe("with 0 < target locked balance < staked amount", () => {
          it("should update lock", async () => {
            // no unlock
            // create lock with target locked balance
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
        describe("with staked amount < target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // create lock with staked amount
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
      });
    });
    describe("with unexpired locked amount", () => {
      describe("with no staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
          });
        });
        describe("with 0 < target locked balance < unexpired locked amount", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
          });
        });
        describe("with unexpired locked amount < target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // no withdraw
          });
        });
      });
      describe("with staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
        describe("with unexpired locked amount < target locked balance < unexpired locked amount + staked amount", () => {
          it("should update lock ", async () => {
            // no unlock
            // add target locked balance - unexpired locked amount to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
        describe("with unexpired locked amount < unexpired locked amount + staked amount < target locked balance", () => {
          it("should update lock ", async () => {
            // no unlock
            // add staked amount to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
        describe("with 0 < target locked balance < unexpired locked amount", () => {
          it("should update lock ", async () => {
            // no unlock
            // no add to lock
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount > staked
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // no change to locked amounts
            // withdraw staked amount
          });
        });
      });
    });
    describe("with expired locked amount", () => {
      describe("with no staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // unlock expired locked amount
            // no new lock
            // staked amount = expired locked amount
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
          });
        });
        describe("with 0 < target locked balance < expired locked amount", () => {
          it("should update lock", async () => {
            // unlock expired locked amount
            // create a new lock for 7 days with target locked balance
            // staked amount = expired locked amount - target locked balance
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
          });
        });
        describe("with expired locked amount < target locked balance", () => {
          it("should update lock", async () => {
            // add 7 days to existing lock
            // locked amount = expired locked amount
            // staked amount = 0
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should fail withdraw amount", async () => {
            // revert as withdraw amount < staked amount == 0
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount
          });
        });
      });
      describe("with staked amount", () => {
        describe("with zero target locked balance", () => {
          it("should update lock", async () => {
            // unlock expired locked amount
            // no new lock
            // staked amount = expired locked amount + staked amount
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount < staked amount
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
          });
        });
        describe("with 0 < target locked balance < expired locked amount", () => {
          it("should update lock", async () => {
            // unlock expired locked amount
            // create a new lock for 7 days with target locked balance
            // new staked amount = expired locked amount - target locked balance + old staked amount
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount < staked amount
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
          });
        });
        describe("with expired locked amount < target locked balance < expired locked amount + staked amount", () => {
          it("should update lock", async () => {
            // add 7 days to lock
            // add target locked balance - expired locked amount
            // new staked amount =  old staked amount - (target locked balance - expired locked amount)
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount < staked amount
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired locked amount
            // withdraw expired locked amount + staked amount
          });
        });
        describe("with expired locked amount < target locked balance > expired locked amount + staked amount", () => {
          it("should update lock", async () => {
            // no unlock
            // add 7 days to lock
            // add staked amount to lock
            // new staked amount = 0
          });
          it("should deposit amount", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should deposit all", async () => {
            // add to staked amount
            // no change to locked amounts
          });
          it("should withdraw amount < staked amount", async () => {
            // new staked amount = old staked amount - withdraw amount
            // no change to locked amounts
          });
          it("should fail withdraw amount > staked amount", async () => {
            // revert as withdraw amount < staked amount
          });
          it("should withdraw all", async () => {
            // target locked balance = 0
            // unlock expired amount
            // withdraw expired amount + staked amount
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
