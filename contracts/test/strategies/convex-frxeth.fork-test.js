const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { frxEthWethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, isCI } = require("../helpers");
const {
  createFixtureLoader,
  convexFrxEthFixture,
  impersonateAndFundContract,
  loadDefaultFixture,
} = require("../_fixture");
const { resolveAsset } = require("../../utils/assets");

const log = require("../../utils/logger")("test:fork:convex:frxETH");

describe("ForkTest: Convex frxETH/WETH Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  const supportedAssets = ["frxETH", "WETH"];

  describe("with mainnet data", () => {
    beforeEach(async () => {
      fixture = await loadDefaultFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { convexFrxEthWethStrategy } = fixture;

      expect(await convexFrxEthWethStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );
      expect(await convexFrxEthWethStrategy.CURVE_POOL_ASSETS_COUNT()).to.equal(
        2
      );
      expect(await convexFrxEthWethStrategy.CURVE_POOL()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
      expect(await convexFrxEthWethStrategy.CURVE_LP_TOKEN()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
      expect(await convexFrxEthWethStrategy.cvxDepositor()).to.equal(
        addresses.mainnet.CVXBooster
      );
      expect(await convexFrxEthWethStrategy.cvxRewardStaker()).to.equal(
        addresses.mainnet.ConvexFrxEthWethRewardsPool
      );
      expect(await convexFrxEthWethStrategy.cvxDepositorPoolId()).to.equal(
        frxEthWethPoolLpPID
      );
    });
    supportedAssets.forEach((symbol) => {
      it(`Should be able to check the ${symbol} balance`, async () => {
        const { convexFrxEthWethStrategy } = fixture;
        const asset = await resolveAsset(symbol, fixture);
        expect(await convexFrxEthWethStrategy.checkBalance(asset.address)).gte(
          0
        );
      });
      it(`${symbol} should be supported`, async () => {
        const { convexFrxEthWethStrategy } = fixture;
        const asset = await resolveAsset(symbol, fixture);
        expect(await convexFrxEthWethStrategy.supportsAsset(asset.address)).to
          .be.true;
      });
    });
  });

  describe("with no assets in the vault", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should be able to harvest the rewards", async function () {
      const {
        josh,
        weth,
        oethHarvester,
        oethDripper,
        oethVault,
        convexFrxEthWethStrategy,
        crv,
      } = fixture;

      // send some CRV to the strategy to partly simulate reward harvesting
      await crv
        .connect(josh)
        .transfer(convexFrxEthWethStrategy.address, parseUnits("10000"));

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // prettier-ignore
      await oethHarvester
          .connect(josh)["harvestAndSwap(address)"](convexFrxEthWethStrategy.address);

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
        convexFrxEthWethStrategy,
        frxETH,
        weth,
        curveFrxEthWethPool,
      } = fixture;

      // Governor can approve all tokens
      const tx = await convexFrxEthWethStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(weth, "Approval");
      await expect(tx).to.emit(frxETH, "Approval");
      await expect(tx).to.emit(curveFrxEthWethPool, "Approval");

      for (const signer of [strategist, josh, oethVaultSigner]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some WETH and frxETH in the vault", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture, {
      wethMintAmount: 5000,
      frxEthMintAmount: 4000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    supportedAssets.forEach((symbol) => {
      it(`Vault should deposit some ${symbol} to the strategy`, async function () {
        const {
          convexFrxEthWethStrategy,
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
          await convexFrxEthWethStrategy.checkBalance(weth.address);
        const frxEthStrategyBalanceBefore =
          await convexFrxEthWethStrategy.checkBalance(frxETH.address);

        // Vault transfers asset to the strategy
        await asset
          .connect(oethVaultSigner)
          .transfer(convexFrxEthWethStrategy.address, depositAmount);

        const tx = await convexFrxEthWethStrategy
          .connect(oethVaultSigner)
          .deposit(asset.address, depositAmount);

        // Check emitted events
        await expect(tx)
          .to.emit(convexFrxEthWethStrategy, "Deposit")
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
          await convexFrxEthWethStrategy.checkBalance(weth.address)
        ).to.approxEqualTolerance(
          wethStrategyBalanceBefore.add(halfDepositAmount)
        );
        expect(
          await convexFrxEthWethStrategy.checkBalance(frxETH.address)
        ).to.approxEqualTolerance(
          frxEthStrategyBalanceBefore.add(halfDepositAmount)
        );
      });
    });
    it("Only vault can deposit to strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;

      const depositAmount = parseUnits("50");
      await weth
        .connect(oethVaultSigner)
        .transfer(convexFrxEthWethStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .deposit(weth.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all frxETH and WETH assets to the strategy", async function () {
      const {
        convexFrxEthWethStrategy,
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
        .transfer(convexFrxEthWethStrategy.address, wethDepositAmount);
      await frxETH
        .connect(oethVaultSigner)
        .transfer(convexFrxEthWethStrategy.address, frxEthDepositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .depositAll();
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Deposit")
        .withNamedArgs({
          _asset: weth.address,
          _pToken: curveFrxEthWethPool.address,
        });
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Deposit")
        .withNamedArgs({
          _asset: frxETH.address,
          _pToken: curveFrxEthWethPool.address,
        });
    });
  });

  describe("with WETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture, {
      wethMintAmount: 5000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    supportedAssets.forEach((symbol) => {
      // frxETH will have a balance even though only WETH was deposited
      it(`${symbol} should have a balance`, async () => {
        const { josh, convexFrxEthWethStrategy } = fixture;

        const asset = await resolveAsset(symbol, fixture);
        expect(await convexFrxEthWethStrategy.checkBalance(asset.address)).gt(
          0
        );

        // This uses a transaction to call a view function so the gas usage can be reported.
        const tx = await convexFrxEthWethStrategy
          .connect(josh)
          .populateTransaction.checkBalance(asset.address);
        await josh.sendTransaction(tx);
      });
    });
    it("Vault should be able to withdraw all", async () => {
      const {
        convexFrxEthWethStrategy,
        curveFrxEthWethPool,
        oeth,
        oethVaultSigner,
        frxETH,
        weth,
      } = fixture;

      const oethSupplyBefore = await oeth.totalSupply();

      const {
        wethWithdrawAmount,
        frxEthWithdrawAmount,
        curveBalances: curveBalancesBefore,
      } = await calcWithdrawAllAmounts(fixture);

      // Now try to withdraw all the WETH and frxETH from the strategy
      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
        .withArgs(
          weth.address,
          curveFrxEthWethPool.address,
          wethWithdrawAmount
        );
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
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
        convexFrxEthWethStrategy,
        oeth,
        curveFrxEthWethPool,
        oethVault,
        oethVaultSigner,
        weth,
      } = fixture;

      const wethWithdrawAmount = oethUnits("1000");

      const curveBalancesBefore = await curveFrxEthWethPool.get_balances();
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      // Now try to withdraw the WETH from the strategy
      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, wethWithdrawAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
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
    it("Only vault can withdraw some WETH from the strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        oethVault,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all WETH from the strategy", async function () {
      const { convexFrxEthWethStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = convexFrxEthWethStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = convexFrxEthWethStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(convexFrxEthWethStrategy, "Withdrawal");
    });
    [0, 1].forEach((coinIndex) => {
      it(`Should calculate Curve LP tokens for withdrawing coin index ${coinIndex}`, async () => {
        const { curveFrxEthWethPool, curveTwoCoinLib, josh } = fixture;
        const coinIndex = 1;
        const withdrawAmount = "1000";
        const withdrawAmountScaled = parseUnits(withdrawAmount);
        const expectedLpAmount = await curveTwoCoinLib.calcWithdrawLpAmount(
          curveFrxEthWethPool.address,
          coinIndex,
          withdrawAmountScaled
        );
        log(`expected LP amount: ${formatUnits(expectedLpAmount)}`);

        const curveGaugeSigner = await impersonateAndFundContract(
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
        const tx = await curveTwoCoinLib
          .connect(josh)
          .populateTransaction.calcWithdrawLpAmount(
            curveFrxEthWethPool.address,
            coinIndex,
            withdrawAmountScaled
          );
        await josh.sendTransaction(tx);
      });
    });
  });
});

// Calculate the WETH and frxETH amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const {
    convexFrxEthWethStrategy,
    cvxFrxEthWethRewardPool,
    curveFrxEthWethPool,
  } = fixture;

  // Get the ETH and OETH balances in the Curve Metapool
  const curveBalances = await curveFrxEthWethPool.get_balances();
  const strategyLpAmount = await cvxFrxEthWethRewardPool.balanceOf(
    convexFrxEthWethStrategy.address
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
