const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");
const { setERC20TokenBalance } = require("../_fund");
const { isCI } = require("../helpers");

const log = require("../../utils/logger")("test:fork:algebra:amo");

const defaultScenarioConfig = {
  attackerFrontRun: {
    moderateAssetIn: "20000",
    largeAssetIn: "10000000",
    largeOTokenIn: "10000000",
  },
  poolImbalance: {
    lotMoreOToken: { addOToken: 1000000 },
    littleMoreOToken: { addOToken: 5000 },
    lotMoreAsset: { addAsset: 2000000 },
    littleMoreAsset: { addAsset: 20000 },
  },
  smallPoolShare: {
    bootstrapAssetSwapIn: "10000000",
    bigLiquidityAsset: "1000000",
    oTokenBuffer: "2000000",
    stressSwapOToken: "1005000",
    stressSwapAsset: "2000000",
    stressSwapAssetAlt: "1006000",
  },
  rebalanceProbe: {
    frontRun: {
      depositAmount: "200000",
      failedDepositAmount: "5000",
      failedDepositAllAmount: "5000",
      assetTiltWithdrawAmount: "4000",
      oTokenTiltWithdrawAmount: "200",
    },
    lotMoreOToken: {
      failedDepositAmount: "5000",
      partialWithdrawAmount: "4000",
      smallSwapAssetsToPool: "3",
      largeSwapAssetsToPool: "3000",
      nearMaxSwapAssetsToPool: "4400",
      excessiveSwapAssetsToPool: "2000000",
      disallowedSwapOTokensToPool: "0.001",
    },
    littleMoreOToken: {
      depositAmount: "12000",
      partialWithdrawAmount: "1000",
      smallSwapAssetsToPool: "3",
      excessiveSwapAssetsToPool: "5000",
      disallowedSwapOTokensToPool: "0.001",
    },
    lotMoreAsset: {
      failedDepositAmount: "6000",
      partialWithdrawAmount: "1000",
      smallSwapOTokensToPool: "0.3",
      largeSwapOTokensToPool: "5000",
      overshootSwapOTokensToPool: "999990",
      disallowedSwapAssetsToPool: "0.0001",
    },
    littleMoreAsset: {
      depositAmount: "18000",
      partialWithdrawAmount: "1000",
      smallSwapOTokensToPool: "8",
      overshootSwapOTokensToPool: "11000",
      disallowedSwapAssetsToPool: "0.0001",
    },
  },
  insolvent: {
    swapOTokensToPool: "10",
  },
  fixtureSetup: {
    imbalanceBalancePool: true,
  },
};

const mergeScenarioConfig = (contextConfig = {}, fixtureConfig = {}) => ({
  attackerFrontRun: {
    ...defaultScenarioConfig.attackerFrontRun,
    ...(contextConfig.attackerFrontRun || {}),
    ...(fixtureConfig.attackerFrontRun || {}),
  },
  poolImbalance: {
    lotMoreOToken: {
      ...defaultScenarioConfig.poolImbalance.lotMoreOToken,
      ...(contextConfig.poolImbalance?.lotMoreOToken || {}),
      ...(fixtureConfig.poolImbalance?.lotMoreOToken || {}),
    },
    littleMoreOToken: {
      ...defaultScenarioConfig.poolImbalance.littleMoreOToken,
      ...(contextConfig.poolImbalance?.littleMoreOToken || {}),
      ...(fixtureConfig.poolImbalance?.littleMoreOToken || {}),
    },
    lotMoreAsset: {
      ...defaultScenarioConfig.poolImbalance.lotMoreAsset,
      ...(contextConfig.poolImbalance?.lotMoreAsset || {}),
      ...(fixtureConfig.poolImbalance?.lotMoreAsset || {}),
    },
    littleMoreAsset: {
      ...defaultScenarioConfig.poolImbalance.littleMoreAsset,
      ...(contextConfig.poolImbalance?.littleMoreAsset || {}),
      ...(fixtureConfig.poolImbalance?.littleMoreAsset || {}),
    },
  },
  smallPoolShare: {
    ...defaultScenarioConfig.smallPoolShare,
    ...(contextConfig.smallPoolShare || {}),
    ...(fixtureConfig.smallPoolShare || {}),
  },
  rebalanceProbe: {
    frontRun: {
      ...defaultScenarioConfig.rebalanceProbe.frontRun,
      ...(contextConfig.rebalanceProbe?.frontRun || {}),
      ...(fixtureConfig.rebalanceProbe?.frontRun || {}),
    },
    lotMoreOToken: {
      ...defaultScenarioConfig.rebalanceProbe.lotMoreOToken,
      ...(contextConfig.rebalanceProbe?.lotMoreOToken || {}),
      ...(fixtureConfig.rebalanceProbe?.lotMoreOToken || {}),
    },
    littleMoreOToken: {
      ...defaultScenarioConfig.rebalanceProbe.littleMoreOToken,
      ...(contextConfig.rebalanceProbe?.littleMoreOToken || {}),
      ...(fixtureConfig.rebalanceProbe?.littleMoreOToken || {}),
    },
    lotMoreAsset: {
      ...defaultScenarioConfig.rebalanceProbe.lotMoreAsset,
      ...(contextConfig.rebalanceProbe?.lotMoreAsset || {}),
      ...(fixtureConfig.rebalanceProbe?.lotMoreAsset || {}),
    },
    littleMoreAsset: {
      ...defaultScenarioConfig.rebalanceProbe.littleMoreAsset,
      ...(contextConfig.rebalanceProbe?.littleMoreAsset || {}),
      ...(fixtureConfig.rebalanceProbe?.littleMoreAsset || {}),
    },
  },
  insolvent: {
    ...defaultScenarioConfig.insolvent,
    ...(contextConfig.insolvent || {}),
    ...(fixtureConfig.insolvent || {}),
  },
  fixtureSetup: {
    ...defaultScenarioConfig.fixtureSetup,
    ...(contextConfig.fixtureSetup || {}),
    ...(fixtureConfig.fixtureSetup || {}),
  },
});

const toUnitAmount = (value) =>
  value && value._isBigNumber ? value : parseUnits(value.toString());
/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * @example
   shouldBehaveLikeAlgebraAmoStrategy(() => ({
      assetToken: addresses.sonic.wS, // address of the asset token in the pool
      oToken: addresses.sonic.os, // address of the oToken in the pool
      amoStrategy: strategy contract, // address of the strategy
      pool: pool contract
      gauge: addresses.sonic.SwapXWSOS.gauge, // address of the gauge
      governor: addresses.sonic.timelock, // address of the governor
      timelock: addresses.sonic.timelock, // address of the timelock
      strategist: addresses.sonic.strategist, // address of the strategist
      nick: addresses.sonic.nick, // nick's address
      vaultSigner: addresses.sonic.vaultSigner, // address of the vault signer
    }));
 */
const shouldBehaveLikeAlgebraAmoStrategy = (contextFunction) => {
  describe("ForkTest: Algebra AMO Strategy", async function () {
    // Retry up to 3 times on CI
    this.retries(isCI ? 3 : 0);
    let fixture, context;
    const getScenarioConfig = () =>
      mergeScenarioConfig(context?.scenarioConfig, fixture?.scenarioConfig);
    describe("post deployment", () => {
      beforeEach(async () => {
        context = await contextFunction();
        fixture = await context.loadFixture();
      });
      it("Should have constants and immutables set", async () => {
        const { amoStrategy, assetToken, oToken, pool, gauge, governor } = fixture;
  
        expect(await amoStrategy.SOLVENCY_THRESHOLD()).to.equal(
          parseUnits("0.998", 18)
        );
        expect(await amoStrategy.asset()).to.equal(assetToken.address);
        expect(await amoStrategy.oToken()).to.equal(
          oToken.address
        );
        expect(await amoStrategy.pool()).to.equal(
          pool.address
        );
        expect(await amoStrategy.gauge()).to.equal(
          gauge.address
        );
        expect(await amoStrategy.governor()).to.equal(
          governor.address
        );
        expect(await amoStrategy.supportsAsset(assetToken.address)).to.true;
        expect(await amoStrategy.maxDepeg()).to.equal(parseUnits("0.01"));
      });
      it("Should be able to check balance", async () => {
        const { assetToken, nick, amoStrategy } = fixture;
  
        const balance = await amoStrategy.checkBalance(assetToken.address);
        log(`check balance ${balance}`);
        expect(balance).gte(0);
  
        // This uses a transaction to call a view function so the gas usage can be reported.
        const tx = await amoStrategy
          .connect(nick)
          .populateTransaction.checkBalance(assetToken.address);
        await nick.sendTransaction(tx);
      });
      it("Only Governor can approve all tokens", async () => {
        const {
          timelock,
          strategist,
          nick,
          vaultSigner,
          amoStrategy,
          pool,
        } = fixture;
  
        expect(await amoStrategy.connect(timelock).isGovernor()).to.equal(
          true
        );
  
        // Timelock can approve all tokens
        const tx = await amoStrategy
          .connect(timelock)
          .safeApproveAllTokens();
        await expect(tx).to.emit(pool, "Approval");
  
        for (const signer of [strategist, nick, vaultSigner]) {
          const tx = amoStrategy.connect(signer).safeApproveAllTokens();
          await expect(tx).to.be.revertedWith("Caller is not the Governor");
        }
      });
      it("Only Governor can set the max depeg", async () => {
        const {
          timelock,
          strategist,
          nick,
          vaultSigner,
          amoStrategy,
        } = fixture;
  
        expect(await amoStrategy.connect(timelock).isGovernor()).to.equal(
          true
        );
  
        // Timelock can update
        const newMaxDepeg = parseUnits("0.02");
        const tx = await amoStrategy
          .connect(timelock)
          .setMaxDepeg(newMaxDepeg);
        await expect(tx)
          .to.emit(amoStrategy, "MaxDepegUpdated")
          .withArgs(newMaxDepeg);
  
        expect(await amoStrategy.maxDepeg()).to.equal(newMaxDepeg);
  
        for (const signer of [strategist, nick, vaultSigner]) {
          const tx = amoStrategy.connect(signer).setMaxDepeg(newMaxDepeg);
          await expect(tx).to.be.revertedWith("Caller is not the Governor");
        }
      });
    });
  
    describe("with asset token in the vault", () => {
      beforeEach(async () => {
        context = await contextFunction();
        fixture = await context.loadFixture({
          assetMintAmount: 5000000,
          depositToStrategy: false,
          balancePool: true,
        });
      });
      it("Vault should deposit asset token to AMO strategy", async function () {
        await assertDeposit(parseUnits("2000"));
      });
      it("Only vault can deposit asset token to AMO strategy", async function () {
        const {
          amoStrategy,
          vaultSigner,
          strategist,
          timelock,
          nick,
          assetToken,
        } = fixture;
  
        const depositAmount = parseUnits("50");
        await assetToken
          .connect(vaultSigner)
          .transfer(amoStrategy.address, depositAmount);
  
        for (const signer of [strategist, timelock, nick]) {
          const tx = amoStrategy
            .connect(signer)
            .deposit(assetToken.address, depositAmount);
  
          await expect(tx).to.revertedWith("Caller is not the Vault");
        }
      });
      it("Only vault can deposit all asset tokens to AMO strategy", async function () {
        const {
          amoStrategy,
          pool,
          vaultSigner,
          strategist,
          timelock,
          nick,
          assetToken,
        } = fixture;
  
        const depositAmount = parseUnits("50");
        await assetToken
          .connect(vaultSigner)
          .transfer(amoStrategy.address, depositAmount);
  
        for (const signer of [strategist, timelock, nick]) {
          const tx = amoStrategy.connect(signer).depositAll();
  
          await expect(tx).to.revertedWith("Caller is not the Vault");
        }
  
        const tx = await amoStrategy.connect(vaultSigner).depositAll();
        await expect(tx)
          .to.emit(amoStrategy, "Deposit")
          .withNamedArgs({ _asset: assetToken.address, _pToken: pool.address });
      });
    });
  
    describe("with the strategy having OToken and asset token in a balanced pool", () => {
      beforeEach(async () => {
        context = await contextFunction();
        fixture = await context.loadFixture({
          assetMintAmount: 5000000,
          depositToStrategy: true,
          balancePool: true,
        });
      });
      it("Vault should deposit asset token", async function () {
        await assertDeposit(parseUnits("5000"));
      });
      it("Vault should be able to withdraw all", async () => {
        await assertWithdrawAll();
      });
      it("Vault should be able to withdraw all in SwapX Emergency", async () => {
        const { amoStrategy, gauge, vaultSigner } = fixture;
  
        const gaugeOwner = await gauge.owner();
        const ownerSigner = await impersonateAndFund(gaugeOwner);
        await gauge.connect(ownerSigner).activateEmergencyMode();
        await assertWithdrawAll();
  
        // Try again when the strategy is empty
        await amoStrategy.connect(vaultSigner).withdrawAll();
      });
      it("Should fail to deposit zero asset token", async () => {
        const { amoStrategy, vaultSigner, assetToken } = fixture;
  
        const tx = amoStrategy
          .connect(vaultSigner)
          .deposit(assetToken.address, 0);
  
        await expect(tx).to.be.revertedWith("Must deposit something");
      });
      it("Should fail to deposit oToken", async () => {
        const { amoStrategy, vaultSigner, oToken } = fixture;
  
        const tx = amoStrategy
          .connect(vaultSigner)
          .deposit(oToken.address, parseUnits("1"));
  
        await expect(tx).to.be.revertedWith("Unsupported asset");
      });
      it("Should fail to withdraw zero asset token", async () => {
        const { amoStrategy, vaultSigner, vault, assetToken } = fixture;
  
        const tx = amoStrategy
          .connect(vaultSigner)
          .withdraw(vault.address, assetToken.address, 0);
  
        await expect(tx).to.be.revertedWith("Must withdraw something");
      });
      it("Should fail to withdraw oToken", async () => {
        const { amoStrategy, vaultSigner, oToken, vault } =
          fixture;
  
        const tx = amoStrategy
          .connect(vaultSigner)
          .withdraw(vault.address, oToken.address, parseUnits("1"));
  
        await expect(tx).to.be.revertedWith("Unsupported asset");
      });
      it("Should fail to withdraw to a user", async () => {
        const { amoStrategy, vaultSigner, assetToken, nick } = fixture;
  
        const tx = amoStrategy
          .connect(vaultSigner)
          .withdraw(nick.address, assetToken.address, parseUnits("1"));
  
        await expect(tx).to.be.revertedWith("Only withdraw to vault allowed");
      });
      it("Vault should be able to withdraw all from empty strategy", async () => {
        const { amoStrategy, vaultSigner } = fixture;
        await assertWithdrawAll();
  
        // Now try again after all the assets have already been withdrawn
        const tx = await amoStrategy
          .connect(vaultSigner)
          .withdrawAll();
  
        // Check emitted events
        await expect(tx).to.not.emit(amoStrategy, "Withdrawal");
      });
      it("Vault should be able to partially withdraw", async () => {
        await assertWithdrawPartial(parseUnits("1000"));
      });
      it("Only vault can withdraw asset token from AMO strategy", async function () {
        const { amoStrategy, vault, strategist, timelock, nick, assetToken } =
          fixture;
  
        for (const signer of [strategist, timelock, nick]) {
          const tx = amoStrategy
            .connect(signer)
            .withdraw(vault.address, assetToken.address, parseUnits("50"));
  
          await expect(tx).to.revertedWith("Caller is not the Vault");
        }
      });
      it("Only vault and governor can withdraw all from AMO strategy", async function () {
        const { amoStrategy, strategist, timelock, nick } = fixture;
  
        for (const signer of [strategist, nick]) {
          const tx = amoStrategy.connect(signer).withdrawAll();
  
          await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
        }
  
        // Governor can withdraw all
        const tx = amoStrategy.connect(timelock).withdrawAll();
        await expect(tx).to.emit(amoStrategy, "Withdrawal");
      });
      it("Harvester can collect rewards", async function () {
        if (fixture.skipHarvesterTest) {
          this.skip();
        }

        const {
          harvester,
          nick,
          amoStrategy,
          gauge,
          rewardToken,
          strategist,
        } = fixture;
  
        const rewardTokenBalanceBefore = await rewardToken.balanceOf(strategist.address);
  
        // Send some SWPx rewards to the gauge
        const distributorAddress = await gauge.DISTRIBUTION();
        const distributorSigner = await impersonateAndFund(distributorAddress);
        const rewardAmount = parseUnits("1000");
        await setERC20TokenBalance(distributorAddress, rewardToken, rewardAmount);
        await gauge
          .connect(distributorSigner)
          .notifyRewardAmount(rewardToken.address, rewardAmount);
  
        // Harvest the rewards
        // prettier-ignore
        const tx = await harvester
          .connect(nick)["harvestAndTransfer(address)"](amoStrategy.address);
  
        await expect(tx).to.emit(amoStrategy, "RewardTokenCollected");
  
        const rewardTokenBalanceAfter = await rewardToken.balanceOf(strategist.address);
        log(
          `Rewards collected ${formatUnits(
            rewardTokenBalanceAfter.sub(rewardTokenBalanceBefore)
          )}`
        );
        expect(rewardTokenBalanceAfter).to.gt(rewardTokenBalanceBefore);
      });
      it("Attacker front-run deposit within range by adding asset token to the pool", async function () {
        if (fixture.skipAdvancedRebalanceTests) {
          this.skip();
        }

        const { nick, oToken, vaultSigner, amoStrategy, assetToken } =
          fixture;
  
        const attackerAssetTokenBalanceBefore = await assetToken.balanceOf(nick.address);
        const assetTokenAmountIn = toUnitAmount(
          getScenarioConfig().attackerFrontRun.moderateAssetIn
        );
  
        const dataBeforeSwap = await snapData();
        logSnapData(
          dataBeforeSwap,
          `\nBefore attacker swaps ${formatUnits(
            assetTokenAmountIn
          )} asset token into the pool for OToken`
        );
  
        // Attacker swaps a lot of asset token for OToken in the pool
        // This drops the pool's asset token/OToken price and increases the OToken/asset token price
        const oTokenAmountOut = await poolSwapTokensIn(assetToken, assetTokenAmountIn);
  
        const depositAmount = toUnitAmount(
          getScenarioConfig().rebalanceProbe.frontRun.depositAmount
        );
  
        const dataBeforeDeposit = await snapData();
        logSnapData(
          dataBeforeDeposit,
          `\nAfter attacker tilted pool and before strategist deposits ${formatUnits(
            depositAmount
          )} asset token`
        );
  
        // Vault deposits wS to the strategy
        await ensureVaultHasAssets(depositAmount);
        await assetToken
          .connect(vaultSigner)
          .transfer(amoStrategy.address, depositAmount);
        await amoStrategy
          .connect(vaultSigner)
          .deposit(assetToken.address, depositAmount);
  
        const dataAfterDeposit = await snapData();
        logSnapData(
          dataAfterDeposit,
          `\nAfter deposit of ${formatUnits(
            depositAmount
          )} asset token to strategy and before attacker swaps ${formatUnits(
            oTokenAmountOut
          )} OToken back into the pool for asset token`
        );
        await logProfit(dataBeforeSwap);
  
        // Attacker swaps the OS back for wS
        await poolSwapTokensIn(oToken, oTokenAmountOut);
  
        const dataAfterFinalSwap = await snapData();
        logSnapData(
          dataAfterFinalSwap,
          `\nAfter attacker swaps ${formatUnits(
            oTokenAmountOut
          )} OToken back into the pool for asset token`
        );
        await logProfit(dataBeforeSwap);
  
        const attackerWsBalanceAfter = await assetToken.balanceOf(nick.address);
        log(
          `Attacker's profit ${formatUnits(
            attackerWsBalanceAfter.sub(attackerAssetTokenBalanceBefore)
          )} asset token`
        );
      });

      describe("When attacker front-run by adding a lot of asset token to the pool", () => {
        let attackerAssetBalanceBefore;
        let dataBeforeSwap;
        let oTokenAmountOut;
        beforeEach(async function () {
          context = await contextFunction();
          if (context.skipAdvancedRebalanceTests) {
            this.skip();
          }
          fixture = await context.loadFixture();
          const { nick, assetToken } = fixture;
  
          attackerAssetBalanceBefore = await assetToken.balanceOf(nick.address);
          const assetTokenAmountIn = toUnitAmount(
            getScenarioConfig().attackerFrontRun.largeAssetIn
          );
  
          dataBeforeSwap = await snapData();
          logSnapData(
            dataBeforeSwap,
            `\nBefore attacker swaps ${formatUnits(
              assetTokenAmountIn
            )} asset token into the pool for OToken`
          );
  
          // Attacker swaps a lot of asset token for OToken in the pool
          // This drops the pool's asset token/OToken price and increases the OToken/asset token price
          oTokenAmountOut = await poolSwapTokensIn(assetToken, assetTokenAmountIn);
        });
        it("Strategist fails to deposit to strategy", async () => {
          await assertFailedDeposit(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.frontRun.failedDepositAmount
            ),
            "price out of range"
          );
        });
        it("Strategist fails to deposit all to strategy", async () => {
          await assertFailedDepositAll(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.frontRun.failedDepositAllAmount
            ),
            "price out of range"
          );
        });
        it("Strategist should withdraw from strategy with a profit", async () => {
          const {
            nick,
            oToken,
            vault,
            vaultSigner,
            amoStrategy,
            assetToken,
          } = fixture;
          const withdrawAmount = toUnitAmount(
            getScenarioConfig().rebalanceProbe.frontRun.assetTiltWithdrawAmount
          );
  
          const dataBeforeWithdraw = await snapData();
          logSnapData(
            dataBeforeWithdraw,
            `\nBefore strategist withdraw ${formatUnits(withdrawAmount)} asset token`
          );
  
          const tx = await amoStrategy
            .connect(vaultSigner)
            .withdraw(vault.address, assetToken.address, withdrawAmount);
  
          const dataAfterWithdraw = await snapData();
          logSnapData(
            dataAfterWithdraw,
            `\nAfter withdraw and before attacker swaps ${formatUnits(
              oTokenAmountOut
            )} OToken back into the pool for asset token`
          );
          await logProfit(dataBeforeSwap);
  
          // Get how much OS was burnt
          const receipt = await tx.wait();
          const redeemEvent = receipt.events.find(
            (e) => e.event === "Withdrawal" && e.args._asset === oToken.address
          );
          log(`\nWithdraw burnt ${formatUnits(redeemEvent.args._amount)} OS`);
  
          // Attacker swaps the OS back for wS
          await poolSwapTokensIn(oToken, oTokenAmountOut);
  
          const dataAfterFinalSwap = await snapData();
          logSnapData(
            dataAfterFinalSwap,
            "\nAfter attacker swaps OToken into the pool for the asset token"
          );
          const profit = await logProfit(dataBeforeSwap);
          expect(profit, "vault profit").to.gt(0);
  
          const attackerWsBalanceAfter = await assetToken.balanceOf(nick.address);
          log(
            `Attacker's profit/loss ${formatUnits(
              attackerWsBalanceAfter.sub(attackerAssetBalanceBefore)
            )} wS`
          );
        });
      });
      describe("When attacker front-run by adding a lot of OToken to the pool", () => {
        const attackerBalanceBefore = {};
        let dataBeforeSwap;
        let assetAmountOut;
        beforeEach(async function () {
          context = await contextFunction();
          if (context.skipAdvancedRebalanceTests) {
            this.skip();
          }
          fixture = await context.loadFixture();
          const { nick, oToken, vault, assetToken } = fixture;
  
          const oTokenAmountIn = toUnitAmount(
            getScenarioConfig().attackerFrontRun.largeOTokenIn
          );

          // Mint OToken using asset token
          await vault.connect(nick).mint(assetToken.address, oTokenAmountIn, 0);
  
          attackerBalanceBefore.oToken = await oToken.balanceOf(nick.address);
          attackerBalanceBefore.assetToken = await assetToken.balanceOf(nick.address);
  
          dataBeforeSwap = await snapData();
          logSnapData(
            dataBeforeSwap,
            `\nBefore attacker swaps ${formatUnits(
              oTokenAmountIn
            )} OToken into the pool for asset token`
          );
  
          // Attacker swaps a lot of OToken for the asset token in the pool
          // This increases the pool's asset/OToken price and decreases the OToken/asset price
          assetAmountOut = await poolSwapTokensIn(oToken, oTokenAmountIn);
        });
        it("Strategist fails to deposit to strategy", async () => {
          await assertFailedDeposit(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.frontRun.failedDepositAmount
            ),
            "price out of range"
          );
        });
        it("Strategist fails to deposit all to strategy", async () => {
          await assertFailedDepositAll(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.frontRun.failedDepositAllAmount
            ),
            "price out of range"
          );
        });
        it("Strategist should withdraw from strategy with a profit", async () => {
          const {
            nick,
            oToken,
            vault,
            vaultSigner,
            amoStrategy,
            assetToken,
          } = fixture;
          const withdrawAmount = toUnitAmount(
            getScenarioConfig().rebalanceProbe.frontRun.oTokenTiltWithdrawAmount
          );
  
          const dataBeforeWithdraw = await snapData();
          logSnapData(
            dataBeforeWithdraw,
            `\nBefore strategist withdraw ${formatUnits(withdrawAmount)} asset token`
          );
  
          const tx = await amoStrategy
            .connect(vaultSigner)
            .withdraw(vault.address, assetToken.address, withdrawAmount);
  
          const dataAfterWithdraw = await snapData();
          logSnapData(
            dataAfterWithdraw,
            `\nAfter withdraw and before attacker swaps ${formatUnits(
              assetAmountOut
            )} asset token back into the pool for OToken`
          );
          await logProfit(dataBeforeSwap);
  
          // Get how much OS was burnt
          const receipt = await tx.wait();
          const redeemEvent = receipt.events.find(
            (e) => e.event === "Withdrawal" && e.args._asset === oToken.address
          );
          log(`\nWithdraw burnt ${formatUnits(redeemEvent.args._amount)} OS`);
  
          // Attacker swaps the asset token back for OToken
          await poolSwapTokensIn(assetToken, assetAmountOut);
  
          const dataAfterFinalSwap = await snapData();
          logSnapData(
            dataAfterFinalSwap,
            "\nAfter attacker swaps asset token into the pool for OToken"
          );
          const profit = await logProfit(dataBeforeSwap);
          expect(profit, "vault profit").to.gt(0);
  
          const attackerBalanceAfter = {};
          attackerBalanceAfter.oToken = await oToken.balanceOf(nick.address);
          attackerBalanceAfter.assetToken = await assetToken.balanceOf(nick.address);
          log(
            `Attacker's profit/loss ${formatUnits(
              attackerBalanceAfter.oToken.sub(attackerBalanceBefore.oToken)
            )} OToken and ${formatUnits(
              attackerBalanceAfter.assetToken.sub(attackerBalanceBefore.assetToken)
            )} asset token`
          );
        });
      });
    });
  
    describe("with a lot more OToken in the pool", () => {
      beforeEach(async function () {
        context = await contextFunction();
        if (context.skipAdvancedRebalanceTests) {
          this.skip();
        }
        fixture = await context.loadFixture({
          assetMintAmount: 5000,
          depositToStrategy: true,
          balancePool: getScenarioConfig().fixtureSetup.imbalanceBalancePool,
          poolAddOTokenAmount:
            getScenarioConfig().poolImbalance.lotMoreOToken.addOToken,
        });
      });
      it("Vault should fail to deposit asset token to AMO strategy", async function () {
        await assertFailedDeposit(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreOToken.failedDepositAmount
          ),
          "price out of range"
        );
      });
      it("Vault should be able to withdraw all", async () => {
        await assertWithdrawAll();
      });
      it("Vault should be able to partially withdraw", async () => {
        await assertWithdrawPartial(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreOToken.partialWithdrawAmount
          )
        );
      });
      it("Strategist should swap a little assets to the pool", async () => {
        await assertSwapAssetsToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreOToken.smallSwapAssetsToPool
          )
        );
      });
      it("Strategist should swap enough asset token to get the pool close to balanced", async () => {
        const { assetReserves, oTokenReserves } = await getPoolReserves();
        // 5% of the extra oToken in the pool
        const oTokenAmount = oTokenReserves.sub(assetReserves).mul(5).div(100);
        const assetAmount = oTokenAmount.mul(assetReserves).div(oTokenReserves);
        log(`oToken amount: ${formatUnits(oTokenAmount)}`);
        log(`asset amount: ${formatUnits(assetAmount)}`);
  
        await assertSwapAssetsToPool(assetAmount);
      });
      it("Strategist should swap a lot of assets to the pool", async () => {
        await assertSwapAssetsToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreOToken.largeSwapAssetsToPool
          )
        );
      });
      it("Strategist should swap most of the asset token owned by the strategy", async () => {
        // TODO calculate how much asset token should be swapped to get the pool balanced
        await assertSwapAssetsToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreOToken.nearMaxSwapAssetsToPool
          )
        );
      });
      it("Strategist should fail to add more asset token than owned by the strategy", async () => {
        const { amoStrategy, strategist } = fixture;
  
        const tx = amoStrategy
          .connect(strategist)
          .swapAssetsToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.lotMoreOToken.excessiveSwapAssetsToPool
            )
          );
  
        await expect(tx).to.be.revertedWith("Not enough LP tokens in gauge");
      });
      it("Strategist should fail to add more OToken to the pool", async () => {
        const { amoStrategy, strategist } = fixture;
  
        // Try swapping OToken into the pool.
        const tx = amoStrategy
          .connect(strategist)
          .swapOTokensToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.lotMoreOToken.disallowedSwapOTokensToPool
            )
          );
  
        await expect(tx).to.be.revertedWith("OTokens balance worse");
      });
    });
  
    describe("with a little more OToken in the pool", () => {
      beforeEach(async function () {
        context = await contextFunction();
        if (context.skipAdvancedRebalanceTests) {
          this.skip();
        }
        fixture = await context.loadFixture({
          assetMintAmount: 20000,
          depositToStrategy: true,
          balancePool: getScenarioConfig().fixtureSetup.imbalanceBalancePool,
          poolAddOTokenAmount:
            getScenarioConfig().poolImbalance.littleMoreOToken.addOToken,
        });
      });
      it("Vault should deposit asset token to AMO strategy", async function () {
        await assertDeposit(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreOToken.depositAmount
          )
        );
      });
      it("Vault should be able to withdraw all", async () => {
        await assertWithdrawAll();
      });
      it("Vault should be able to partially withdraw", async () => {
        await assertWithdrawPartial(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreOToken.partialWithdrawAmount
          )
        );
      });
      it("Strategist should swap a little assets to the pool", async () => {
        await assertSwapAssetsToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreOToken.smallSwapAssetsToPool
          )
        );
      });
      it("Strategist should swap enough asset token to get the pool close to balanced", async () => {
        const { assetReserves, oTokenReserves } = await getPoolReserves();
        // 50% of the extra OToken in the pool gets close to balanced
        const oTokenAmount = oTokenReserves.sub(assetReserves).mul(50).div(100);
        const assetAmount = oTokenAmount.mul(assetReserves).div(oTokenReserves);

        await assertSwapAssetsToPool(assetAmount);
      });
      it("Strategist should fail to add too much asset token to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const dataBefore = await snapData();
        await logSnapData(dataBefore, "Before swapping assets to the pool");

        // Try swapping too much asset token in.
        const tx = amoStrategy
          .connect(strategist)
          .swapAssetsToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.littleMoreOToken.excessiveSwapAssetsToPool
            )
          );

        await expect(tx).to.be.revertedWith("Assets overshot peg");
      });
      it("Strategist should fail to add zero asset token to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy.connect(strategist).swapAssetsToPool(0);

        await expect(tx).to.be.revertedWith("Must swap something");
      });
      it("Strategist should fail to add more OToken to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapOTokensToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.littleMoreOToken.disallowedSwapOTokensToPool
            )
          );

        await expect(tx).to.be.revertedWith("OTokens balance worse");
      });
    });

    describe("with a lot more asset token in the pool", () => {
      beforeEach(async function () {
        context = await contextFunction();
        if (context.skipAdvancedRebalanceTests) {
          this.skip();
        }
        fixture = await context.loadFixture({
          assetMintAmount: 5000,
          depositToStrategy: true,
          balancePool: getScenarioConfig().fixtureSetup.imbalanceBalancePool,
          poolAddAssetAmount:
            getScenarioConfig().poolImbalance.lotMoreAsset.addAsset,
        });
      });
      it("Vault should fail to deposit asset token to strategy", async function () {
        await assertFailedDeposit(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreAsset.failedDepositAmount
          ),
          "price out of range"
        );
      });
      it("Vault should be able to withdraw all", async () => {
        await assertWithdrawAll();
      });
      it("Vault should be able to partially withdraw", async () => {
        await assertWithdrawPartial(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreAsset.partialWithdrawAmount
          )
        );
      });
      it("Strategist should swap a little OToken to the pool", async () => {
        await assertSwapOTokensToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreAsset.smallSwapOTokensToPool
          )
        );
      });
      it("Strategist should swap a lot of OToken to the pool", async () => {
        await assertSwapOTokensToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.lotMoreAsset.largeSwapOTokensToPool
          )
        );
      });
      it("Strategist should get the pool close to balanced", async () => {
        const { assetReserves, oTokenReserves } = await getPoolReserves();
        // 32% of the extra asset token in the pool gets pretty close to balanced
        const oTokenAmount = assetReserves.sub(oTokenReserves).mul(32).div(100);

        await assertSwapOTokensToPool(oTokenAmount);
      });
      it("Strategist should fail to add so much OToken that it overshoots", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapOTokensToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.lotMoreAsset.overshootSwapOTokensToPool
            )
          );

        await expect(tx).to.be.revertedWith("OTokens overshot peg");
      });
      it("Strategist should fail to add more asset token to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapAssetsToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.lotMoreAsset.disallowedSwapAssetsToPool
            )
          );

        await expect(tx).to.be.revertedWith("Assets balance worse");
      });
    });

    describe("with a little more asset token in the pool", () => {
      beforeEach(async function () {
        context = await contextFunction();
        if (context.skipAdvancedRebalanceTests) {
          this.skip();
        }
        fixture = await context.loadFixture({
          assetMintAmount: 20000,
          depositToStrategy: true,
          balancePool: getScenarioConfig().fixtureSetup.imbalanceBalancePool,
          poolAddAssetAmount:
            getScenarioConfig().poolImbalance.littleMoreAsset.addAsset,
        });
      });
      it("Vault should deposit asset token to AMO strategy", async function () {
        await assertDeposit(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreAsset.depositAmount
          )
        );
      });
      it("Vault should be able to withdraw all", async () => {
        await assertWithdrawAll();
      });
      it("Vault should be able to partially withdraw", async () => {
        await assertWithdrawPartial(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreAsset.partialWithdrawAmount
          )
        );
      });
      it("Strategist should swap a little OToken to the pool", async () => {
        await assertSwapOTokensToPool(
          toUnitAmount(
            getScenarioConfig().rebalanceProbe.littleMoreAsset.smallSwapOTokensToPool
          )
        );
      });
      it("Strategist should get the pool close to balanced", async () => {
        const { assetReserves, oTokenReserves } = await getPoolReserves();
        // 50% of the extra asset token in the pool gets pretty close to balanced
        const oTokenAmount = assetReserves.sub(oTokenReserves).mul(50).div(100);

        await assertSwapOTokensToPool(oTokenAmount);
      });
      it("Strategist should fail to add zero OToken to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy.connect(strategist).swapOTokensToPool(0);

        await expect(tx).to.be.revertedWith("Must swap something");
      });
      it("Strategist should fail to add too much OToken to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapOTokensToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.littleMoreAsset.overshootSwapOTokensToPool
            )
          );

        await expect(tx).to.be.revertedWith("OTokens overshot peg");
      });
      it("Strategist should fail to add more asset token to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapAssetsToPool(
            toUnitAmount(
              getScenarioConfig().rebalanceProbe.littleMoreAsset.disallowedSwapAssetsToPool
            )
          );

        await expect(tx).to.be.revertedWith("Assets balance worse");
      });
    });

    describe("with the strategy owning a small percentage of the pool", () => {
      let dataBefore;

      beforeEach(async function () {
        context = await contextFunction();
        if (context.skipAdvancedRebalanceTests) {
          this.skip();
        }
        fixture = await context.loadFixture({
          assetMintAmount: 5000,
          depositToStrategy: true,
          balancePool: true,
        });

        const { nick, oToken, pool, assetToken } = fixture;

        // Other users add a lot more liquidity to the pool.
        const bigAmount = toUnitAmount(
          getScenarioConfig().smallPoolShare.bigLiquidityAsset
        );
        // Acquire OToken by swapping asset token in, then add balanced-like liquidity
        // while preserving enough OToken for the swap-heavy tests that follow.
        await poolSwapTokensIn(
          assetToken,
          toUnitAmount(getScenarioConfig().smallPoolShare.bootstrapAssetSwapIn)
        );
        const oTokenBalance = await oToken.balanceOf(nick.address);
        const oTokenBufferForTests = toUnitAmount(
          getScenarioConfig().smallPoolShare.oTokenBuffer
        );
        const oTokenToPool = oTokenBalance.sub(oTokenBufferForTests);
        expect(oTokenToPool).to.gt(0);

        await assetToken.connect(nick).transfer(pool.address, bigAmount);
        await oToken.connect(nick).transfer(pool.address, oTokenToPool);
        await pool.connect(nick).mint(nick.address);

        dataBefore = await snapData();
        await logSnapData(dataBefore);
      });

      it("A lot of OToken is swapped into the pool", async () => {
        const { oToken, amoStrategy, assetToken } = fixture;

        // Swap OToken into the pool and asset token out.
        await poolSwapTokensIn(
          oToken,
          toUnitAmount(getScenarioConfig().smallPoolShare.stressSwapOToken)
        );
        await logSnapData(await snapData(), "\nAfter swapping OToken into the pool");

        expect(
          await amoStrategy.checkBalance(assetToken.address),
          "Strategy's check balance"
        ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));

        // Swap asset token into the pool and OToken out.
        await poolSwapTokensIn(
          assetToken,
          toUnitAmount(getScenarioConfig().smallPoolShare.stressSwapAsset)
        );
        await logSnapData(
          await snapData(),
          "\nAfter swapping asset token into the pool"
        );

        expect(
          await amoStrategy.checkBalance(assetToken.address),
          "Strategy's check balance"
        ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
      });

      it("A lot of asset token is swapped into the pool", async () => {
        const { amoStrategy, oToken, assetToken } = fixture;

        // Swap asset token into the pool and OToken out.
        await poolSwapTokensIn(
          assetToken,
          toUnitAmount(getScenarioConfig().smallPoolShare.stressSwapAssetAlt)
        );
        await logSnapData(
          await snapData(),
          "\nAfter swapping asset token into the pool"
        );

        expect(
          await amoStrategy.checkBalance(assetToken.address),
          "Strategy's check balance"
        ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));

        // Swap OToken into the pool and asset token out.
        await poolSwapTokensIn(
          oToken,
          toUnitAmount(getScenarioConfig().smallPoolShare.stressSwapOToken)
        );
        await logSnapData(await snapData(), "\nAfter swapping OToken into the pool");

        expect(
          await amoStrategy.checkBalance(assetToken.address),
          "Strategy's check balance"
        ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
      });
    });

    describe("with an insolvent vault", () => {
      beforeEach(async () => {
        context = await contextFunction();
        fixture = await context.loadFixture({
          assetMintAmount: 5000000,
          depositToStrategy: false,
        });

        const { vault, vaultSigner, amoStrategy, assetToken } = fixture;

        // Deposit a little to the strategy.
        const littleAmount = parseUnits("100");
        await assetToken
          .connect(vaultSigner)
          .transfer(amoStrategy.address, littleAmount);
        await amoStrategy
          .connect(vaultSigner)
          .deposit(assetToken.address, littleAmount);

        const totalAssets = await vault.totalValue();
        // Calculate a 0.21% (21 basis points) loss.
        const lossAmount = totalAssets.mul(21).div(10000);
        await assetToken.connect(vaultSigner).transfer(addresses.dead, lossAmount);
        expect(
          await assetToken.balanceOf(vault.address),
          "Must have enough asset token in vault to make insolvent"
        ).to.gte(lossAmount);
      });

      it("Should fail to deposit", async () => {
        const { vaultSigner, amoStrategy, assetToken } = fixture;

        // Vault calls deposit on the strategy.
        const depositAmount = parseUnits("10");
        await assetToken
          .connect(vaultSigner)
          .transfer(amoStrategy.address, depositAmount);
        const tx = amoStrategy
          .connect(vaultSigner)
          .deposit(assetToken.address, depositAmount);

        await expect(tx).to.be.revertedWith("Protocol insolvent");
      });

      it("Should fail to withdraw", async () => {
        const { vault, vaultSigner, amoStrategy, assetToken } = fixture;

        // Vault withdraws from the strategy.
        const tx = amoStrategy
          .connect(vaultSigner)
          .withdraw(vault.address, assetToken.address, parseUnits("10"));

        await expect(tx).to.be.revertedWith("Protocol insolvent");
      });

      it("Should withdraw all", async () => {
        const { vaultSigner, amoStrategy } = fixture;

        const tx = amoStrategy.connect(vaultSigner).withdrawAll();

        await expect(tx).to.not.revertedWith("Protocol insolvent");
      });

      it("Should fail to swap assets to the pool", async () => {
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapAssetsToPool(parseUnits("10"));

        await expect(tx).to.be.revertedWith("Protocol insolvent");
      });

      it("Should fail to swap OToken to the pool", async () => {
        if (fixture.skipAdvancedRebalanceTests) {
          return;
        }
        const { amoStrategy, strategist } = fixture;

        const tx = amoStrategy
          .connect(strategist)
          .swapOTokensToPool(
            toUnitAmount(getScenarioConfig().insolvent.swapOTokensToPool)
          );

        await expect(tx).to.be.revertedWith("Protocol insolvent");
      });
    });
  
    const poolSwapTokensIn = async (tokenIn, amountIn) => {
      const { nick, pool, assetToken, oTokenPoolIndex } = fixture;
      const amountOut = await pool.getAmountOut(amountIn, tokenIn.address);
      await tokenIn.connect(nick).transfer(pool.address, amountIn);

      if (tokenIn.address == assetToken.address) {
        await pool.swap(
          oTokenPoolIndex == 1 ? 0 : amountOut,
          oTokenPoolIndex == 1 ? amountOut: 0,
          nick.address,
          "0x"
        );
      } else {
        await pool.swap(
          oTokenPoolIndex == 0 ? 0 : amountOut,
          oTokenPoolIndex == 0 ? amountOut: 0,
          nick.address,
          "0x"
        );
      }
  
      return amountOut;
    };
  
    const precision = parseUnits("1", 18);
    // Calculate the value of asset token and OToken assuming the pool is balanced
    const calcReserveValue = (reserves) => {
      const k = calcInvariant(reserves);
  
      // If x = y, let’s denote x = y = z (where z is the common reserve value)
      // Substitute z into the invariant:
      // k = z^3 * z + z * z^3
      // k = 2 * z^4
      // Going back the other way to calculate the common reserve value z
      // z = (k / 2) ^ (1/4)
      // the total value of the pool when x = y is 2 * z, which is 2 * (k / 2) ^ (1/4)
      const zSquared = sqrt(k.mul(precision).div(2));
      const z = sqrt(zSquared.mul(precision));
      return z.mul(2);
    };
  
    const calcInvariant = (reserves) => {
      const x = reserves.assetToken;
      const y = reserves.oToken;
      const a = x.mul(y).div(precision);
      const b = x.mul(x).div(precision).add(y.mul(y).div(precision));
      const k = a.mul(b).div(precision);
  
      return k;
    };
  
    // Babylonian square root function for Ethers.js BigNumber
    function sqrt(value) {
      // Convert input to BigNumber if it isn't already
      let bn = ethers.BigNumber.from(value);
  
      // Handle edge cases
      if (bn.lt(0)) {
        throw new Error("Square root of negative number is not supported");
      }
      if (bn.eq(0)) {
        return ethers.BigNumber.from(0);
      }
  
      // Initial guess (number / 2)
      let guess = bn.div(2);
  
      // Define precision threshold (in wei scale, 10^-18)
      const epsilon = ethers.BigNumber.from("1"); // 1 wei precision
  
      // Keep refining until we reach desired precision
      while (true) {
        // Babylonian method: nextGuess = (guess + number/guess) / 2
        // Using mul and div for BigNumber arithmetic
        let numerator = guess.add(bn.div(guess));
        let nextGuess = numerator.div(2);
  
        // Calculate absolute difference
        let diff = nextGuess.gt(guess)
          ? nextGuess.sub(guess)
          : guess.sub(nextGuess);
  
        // If difference is less than epsilon, we're done
        if (diff.lte(epsilon)) {
          return nextGuess;
        }
  
        // Update guess for next iteration
        guess = nextGuess;
      }
    }
  
    const snapData = async () => {
      const { vault, amoStrategy, oToken, pool, gauge, assetToken } =
        fixture;
  
      const stratBalance = await amoStrategy.checkBalance(assetToken.address);
      const oTokenSupply = await oToken.totalSupply();
      const vaultAssets = await vault.totalValue();
      const poolSupply = await pool.totalSupply();
      const { assetReserves, oTokenReserves } = await getPoolReserves();
      const reserves = { assetToken: assetReserves, oToken: oTokenReserves };

      // Amount of asset token bought from selling 1 oToken
      const assetAmount = await pool.getAmountOut(
        parseUnits("1"),
        oToken.address
      );
      // asset/oToken price = assetToken / oToken
      const sellPrice = assetAmount;
  
      // Amount of asset token sold from buying 1 OToken
      const oTokenAmount = await pool.getAmountOut(parseUnits("1"), assetToken.address);
      // OToken/asset price = asset / OToken
      const buyPrice = parseUnits("1", 36).div(oTokenAmount);
  
      const k = calcInvariant(reserves);
      const stratGaugeBalance = await gauge.balanceOf(
        amoStrategy.address
      );
      const gaugeSupply = await gauge.totalSupply();
      const vaultAssetBalance = await assetToken.balanceOf(vault.address);
      const stratAssetBalance = await assetToken.balanceOf(amoStrategy.address);
  
      return {
        stratBalance,
        oTokenSupply,
        vaultAssets,
        poolSupply,
        reserves: { assetToken: assetReserves, oToken: oTokenReserves },
        buyPrice,
        sellPrice,
        stratGaugeBalance,
        gaugeSupply,
        vaultAssetBalance,
        stratAssetBalance,
        k,
      };
    };
  
    const logSnapData = async (data, message) => {
      const totalReserves = data.reserves.assetToken.add(data.reserves.oToken);
      const reserversPercentage = {
        assetToken: data.reserves.assetToken.mul(10000).div(totalReserves),
        oToken: data.reserves.oToken.mul(10000).div(totalReserves),
      };
      const gaugePercentage = data.gaugeSupply.eq(0)
        ? 0
        : data.stratGaugeBalance.mul(10000).div(data.gaugeSupply);
      if (message) {
        log(message);
      }
      log(`Strategy balance    : ${formatUnits(data.stratBalance)}`);
      log(`oToken supply       : ${formatUnits(data.oTokenSupply)}`);
      log(`Vault assets        : ${formatUnits(data.vaultAssets)}`);
      log(`pool supply         : ${formatUnits(data.poolSupply)}`);
      log(
        `reserves assetToken   : ${formatUnits(data.reserves.assetToken)} ${formatUnits(
          reserversPercentage.assetToken,
          2
        )}%`
      );
      log(
        `reserves OToken       : ${formatUnits(data.reserves.oToken)} ${formatUnits(
          reserversPercentage.oToken,
          2
        )}%`
      );
      log(`buy price           : ${formatUnits(data.buyPrice)} OToken/assetToken`);
      log(`sell price          : ${formatUnits(data.sellPrice)} OToken/assetToken`);
      log(`Invariant K         : ${formatUnits(data.k)}`);
      log(
        `strat gauge balance : ${formatUnits(
          data.stratGaugeBalance
        )} ${formatUnits(gaugePercentage, 2)}%`
      );
      log(`gauge supply        : ${formatUnits(data.gaugeSupply)}`);
      log(`vault asset balance : ${formatUnits(data.vaultAssetBalance)}`);
    };
  
    const logProfit = async (dataBefore) => {
      const { oToken, vault, amoStrategy, assetToken } = fixture;
  
      const stratBalanceAfter = await amoStrategy.checkBalance(assetToken.address);
      const oTokenSupplyAfter = await oToken.totalSupply();
      const vaultAssetsAfter = await vault.totalValue();
      const profit = vaultAssetsAfter
        .sub(dataBefore.vaultAssets)
        .add(dataBefore.oTokenSupply.sub(oTokenSupplyAfter));
  
      log(
        `Change strat balance: ${formatUnits(
          stratBalanceAfter.sub(dataBefore.stratBalance)
        )}`
      );
      log(
        `Change vault assets : ${formatUnits(
          vaultAssetsAfter.sub(dataBefore.vaultAssets)
        )}`
      );
      log(
        `Change oToken supply : ${formatUnits(
          oTokenSupplyAfter.sub(dataBefore.oTokenSupply)
        )}`
      );
      log(`Profit              : ${formatUnits(profit)}`);
  
      return profit;
    };
  
    const assertChangedData = async (dataBefore, delta) => {
      const { oToken, vault, amoStrategy, gauge, assetToken } =
        fixture;
  
      if (delta.stratBalance != undefined) {
        const expectedStratBalance = dataBefore.stratBalance.add(
          delta.stratBalance
        );
        log(`Expected strategy balance: ${formatUnits(expectedStratBalance)}`);
  
        expect(await amoStrategy.checkBalance(assetToken.address)).to.withinRange(
          expectedStratBalance.sub(15),
          expectedStratBalance.add(15),
          "Strategy's check balance"
        );
      }
  
      if (delta.oTokenSupply != undefined) {
        const expectedSupply = dataBefore.oTokenSupply.add(delta.oTokenSupply);
        expect(await oToken.totalSupply(), "oToken total supply").to.equal(
          expectedSupply
        );
      }
  
      // Check Vault's asset token balance
      if (delta.vaultAssetBalance != undefined) {
          expect(await assetToken.balanceOf(vault.address)).to.equal(
          dataBefore.vaultAssetBalance.add(delta.vaultAssetBalance),
          "Vault's assetToken balance"
        );
      }
  
      // Check the pool's reserves
      if (delta.reserves != undefined) {
        const { assetReserves, oTokenReserves } = await getPoolReserves();
  
        // If the asset reserves delta is a function, call it to check the asset token reserves
        if (typeof delta.reserves.assetToken == "function") {
          // Call test function to check the asset token reserves
          delta.reserves.assetToken(assetReserves);
        } else {
          expect(assetReserves, "assetToken reserves").to.equal(
            dataBefore.reserves.assetToken.add(delta.reserves.assetToken)
          );
        }
        // Check oToken reserves delta
        expect(oTokenReserves, "oToken reserves").to.equal(
          dataBefore.reserves.oToken.add(delta.reserves.oToken)
        );
      }
  
      if (delta.stratGaugeBalance) {
        // Check the strategy's gauge balance
        const expectedStratGaugeBalance = dataBefore.stratGaugeBalance.add(
          delta.stratGaugeBalance
        );
        expect(
          await gauge.balanceOf(amoStrategy.address)
        ).to.withinRange(
          expectedStratGaugeBalance.sub(1),
          expectedStratGaugeBalance.add(1),
          "Strategy's gauge balance"
        );
      }
    };
  
    async function assertDeposit(assetDepositAmount) {
      const {
        nick,
        amoStrategy,
        oToken,
        vault,
        pool,
        vaultSigner,
        assetToken,
      } = fixture;

      await assetToken.connect(nick).approve(vault.address, assetDepositAmount);
      await vault.connect(nick).mint(assetToken.address, assetDepositAmount, 0);
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "\nBefore depositing asset to strategy");
  
      const { lpMintAmount, oTokenMintAmount } = await calcOTokenMintAmount(
        assetDepositAmount
      );
  
      // Vault transfers asset to strategy
      await assetToken
        .connect(vaultSigner)
        .transfer(amoStrategy.address, assetDepositAmount);
      // Vault calls deposit on the strategy
      const tx = await amoStrategy
        .connect(vaultSigner)
        .deposit(assetToken.address, assetDepositAmount);
  
      await logSnapData(
        await snapData(),
        `\nAfter depositing ${formatUnits(assetDepositAmount)} asset to strategy`
      );
      await logProfit(dataBefore);
      
      // Check emitted events
      await expect(tx).to.emit(amoStrategy, "Deposit")
        .withArgs(assetToken.address, pool.address, assetDepositAmount);
      await expect(tx).to.emit(amoStrategy, "Deposit")
        .withArgs(oToken.address, pool.address, oTokenMintAmount);
  
      // Calculate the value of the asset token and oToken added to the pool if the pool was balanced
      const depositValue = calcReserveValue({
        assetToken: assetDepositAmount,
        oToken: oTokenMintAmount,
      });
      log(`Value of deposit: ${formatUnits(depositValue)}`);
  
      await assertChangedData(dataBefore, {
        stratBalance: depositValue,
        oTokenSupply: oTokenMintAmount,
        reserves: { assetToken: assetDepositAmount, oToken: oTokenMintAmount },
        vaultAssetBalance: assetDepositAmount.mul(-1),
        gaugeSupply: lpMintAmount,
      });
      
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's OToken balance"
      ).to.equal(0);
    }
  
    async function ensureVaultHasAssets(requiredAmount) {
      const { vault, assetToken } = fixture;
      const vaultBalance = await assetToken.balanceOf(vault.address);
      if (vaultBalance.gte(requiredAmount)) {
        return;
      }
      await setERC20TokenBalance(vault.address, assetToken, requiredAmount);
    }

    async function assertFailedDeposit(assetDepositAmount, errorMessage) {
      const { assetToken, vaultSigner, amoStrategy } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "\nBefore depositing asset token to strategy");
  
      await ensureVaultHasAssets(assetDepositAmount);

      // Vault transfers wS to strategy
      await assetToken
        .connect(vaultSigner)
        .transfer(amoStrategy.address, assetDepositAmount);
  
      // Vault calls deposit on the strategy
      const tx = amoStrategy
        .connect(vaultSigner)
        .deposit(assetToken.address, assetDepositAmount);
  
      await expect(tx, "deposit to strategy").to.be.revertedWith(errorMessage);
    }
  
    async function assertFailedDepositAll(assetDepositAmount, errorMessage) {
      const { assetToken, vaultSigner, amoStrategy } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "\nBefore depositing all wS to strategy");
  
      await ensureVaultHasAssets(assetDepositAmount);

      // Vault transfers wS to strategy
      await assetToken
        .connect(vaultSigner)
        .transfer(amoStrategy.address, assetDepositAmount);
  
      // Vault calls depositAll on the strategy
      const tx = amoStrategy.connect(vaultSigner).depositAll();
  
      await expect(tx, "depositAll to strategy").to.be.revertedWith(errorMessage);
    }
  
    async function assertWithdrawAll() {
      const { amoStrategy, pool, oToken, vaultSigner, assetToken } =
      fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore);
  
      const { oTokenBurnAmount, assetTokenWithdrawAmount } = await calcWithdrawAllAmounts();
  
      // Now try to withdraw all the wS from the strategy
      const tx = await amoStrategy.connect(vaultSigner).withdrawAll();
  
      await logSnapData(await snapData(), "\nAfter full withdraw");
      await logProfit(dataBefore);
  
      // Check emitted events
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(assetToken.address, pool.address, assetTokenWithdrawAmount);
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(oToken.address, pool.address, oTokenBurnAmount);
  
      // Calculate the value of the asset token and oToken removed from the pool if the pool was balanced
      const withdrawValue = calcReserveValue({
        assetToken: assetTokenWithdrawAmount,
        oToken: oTokenBurnAmount,
      });
  
      await assertChangedData(dataBefore, {
        stratBalance: withdrawValue.mul(-1),
        oTokenSupply: oTokenBurnAmount.mul(-1),
        reserves: { assetToken: assetTokenWithdrawAmount.mul(-1), oToken: oTokenBurnAmount.mul(-1) },
        vaultAssetBalance: assetTokenWithdrawAmount,
        stratGaugeBalance: dataBefore.stratGaugeBalance.mul(-1),
      });
  
      expect(
        assetTokenWithdrawAmount.add(oTokenBurnAmount),
        "asset token withdraw and oToken burn >= strategy balance"
      ).to.gte(dataBefore.stratBalance);
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's oToken balance"
      ).to.equal(0);
    }
  
    async function assertWithdrawPartial(assetTokenWithdrawAmount) {
      const {
        amoStrategy,
        oToken,
        pool,
        vault,
        vaultSigner,
        assetToken,
      } = fixture;
  
      const dataBefore = await snapData();
  
      const { lpBurnAmount, oTokenBurnAmount } = await calcOTokenWithdrawAmount(
        assetTokenWithdrawAmount
      );
  
      // Now try to withdraw the asset token from the strategy
      const tx = await amoStrategy
        .connect(vaultSigner)
        .withdraw(vault.address, assetToken.address, assetTokenWithdrawAmount);
  
      await logSnapData(
        await snapData(),
        `\nAfter withdraw of ${formatUnits(assetTokenWithdrawAmount)}`
      );
      await logProfit(dataBefore);
  
      // Check emitted events
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(assetToken.address, pool.address, assetTokenWithdrawAmount);
      await expect(tx).to.emit(amoStrategy, "Withdrawal").withNamedArgs({
        _asset: oToken.address,
        _pToken: pool.address,
      });
  
      // Calculate the value of the asset token and OToken removed from the pool if the pool was balanced
      const withdrawValue = calcReserveValue({
        assetToken: assetTokenWithdrawAmount,
        oToken: oTokenBurnAmount,
      });
  
      await assertChangedData(dataBefore, {
        stratBalance: withdrawValue.mul(-1),
        oTokenSupply: oTokenBurnAmount.mul(-1),
        reserves: {
          assetToken: (actualAssetTokenReserve) => {
            const expectedAssetTokenReserves =
              dataBefore.reserves.assetToken.sub(assetTokenWithdrawAmount);
  
            expect(actualAssetTokenReserve).to.withinRange(
              expectedAssetTokenReserves.sub(50),
              expectedAssetTokenReserves,
              "asset token reserves"
            );
          },
          oToken: oTokenBurnAmount.mul(-1),
        },
        vaultAssetBalance: assetTokenWithdrawAmount,
        gaugeSupply: lpBurnAmount.mul(-1),
      });
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's OToken balance"
      ).to.equal(0);
    }
  
    async function assertSwapAssetsToPool(assetAmount) {
      const { oToken, amoStrategy, pool, strategist, assetToken } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(
        dataBefore,
        `Before swapping ${formatUnits(assetAmount)} wS into the pool`
      );
  
      const { lpBurnAmount: expectedLpBurnAmount, oTokenBurnAmount: oTokenBurnAmount1 } =
        await calcOTokenWithdrawAmount(assetAmount);
      // TODO this is not accurate as the liquidity needs to be removed first
      const oTokenBurnAmount2 = await pool.getAmountOut(assetAmount, assetToken.address);
      const oTokenBurnAmount = oTokenBurnAmount1.add(oTokenBurnAmount2);
  
      // Swap asset token to the pool and burn the received OToken from the pool
      const tx = await amoStrategy
        .connect(strategist)
        .swapAssetsToPool(assetAmount);
  
      await logSnapData(await snapData(), "\nAfter swapping assets to the pool");
      await logProfit(dataBefore);
  
      // Check emitted event
      await expect(tx).to.emittedEvent("SwapAssetsToPool", [
        (actualAssetTokenAmount) => {
          expect(actualAssetTokenAmount).to.withinRange(
            assetAmount.sub(1),
            assetAmount.add(1),
            "SwapAssetsToPool event asset token amount"
          );
        },
        expectedLpBurnAmount,
        (actualOTokenBurnAmount) => {
          // TODO this can be tightened once oTokenBurnAmount is more accurately calculated
          expect(actualOTokenBurnAmount).to.approxEqualTolerance(
            oTokenBurnAmount,
            10,
            "SwapAssetsToPool event oTokenBurnt"
          );
        },
      ]);
  
      await assertChangedData(
        dataBefore,
        {
          // stratBalance: osBurnAmount.mul(-1),
          vaultAssetBalance: 0,
          stratGaugeBalance: 0,
        },
        fixture
      );
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's oToken balance"
      ).to.equal(0);
    }
  
    async function assertSwapOTokensToPool(oTokenAmount) {
      const { oToken, pool, amoStrategy, strategist } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "Before swapping OTokens to the pool");
  
      // Mint OToken and swap into the pool, then mint more OToken to add with the swapped out asset token.
      const tx = await amoStrategy
        .connect(strategist)
        .swapOTokensToPool(oTokenAmount);
  
      // Check emitted event
      await expect(tx)
        .emit(amoStrategy, "SwapOTokensToPool")
        .withNamedArgs({ oTokenMinted: oTokenAmount });
  
      await logSnapData(await snapData(), "\nAfter swapping OTokens to the pool");
      await logProfit(dataBefore);
  
      await assertChangedData(
        dataBefore,
        {
          // stratBalance: osBurnAmount.mul(-1),
          vaultAssetBalance: 0,
          stratGaugeBalance: 0,
        },
        fixture
      );
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's OToken balance"
      ).to.equal(0);
    }
  
    // Calculate the minted OS amount for a deposit
    async function calcOTokenMintAmount(assetDepositAmount) {
      const { pool } = fixture;
      
      const { assetReserves, oTokenReserves } = await getPoolReserves();
  
      const oTokenMintAmount = assetDepositAmount.mul(oTokenReserves).div(assetReserves);
      log(`OToken mint amount      : ${formatUnits(oTokenMintAmount)}`);
  
      const lpTotalSupply = await pool.totalSupply();
      const lpMintAmount = assetDepositAmount.mul(lpTotalSupply).div(assetReserves);
  
      return { lpMintAmount, oTokenMintAmount };
    }
    
    async function getPoolReserves() {
      const { pool, oTokenPoolIndex } = fixture;

      let assetReserves, oTokenReserves;
      // Get the reserves of the pool
      const { _reserve0, _reserve1 } = await pool.getReserves();
      
      assetReserves = oTokenPoolIndex === 0 ? _reserve1 : _reserve0;
      oTokenReserves = oTokenPoolIndex === 0 ? _reserve0 : _reserve1;

      return { assetReserves, oTokenReserves };
    }
    // Calculate the amount of oToken burnt from a withdraw
    async function calcOTokenWithdrawAmount(assetTokenWithdrawAmount) {
      const { pool } = fixture;
  
      const { assetReserves, oTokenReserves } = await getPoolReserves();
  
      // lp tokens to burn = asset token withdrawn * total LP supply / asset token pool balance
      const totalLpSupply = await pool.totalSupply();
      const lpBurnAmount = assetTokenWithdrawAmount
        .mul(totalLpSupply)
        .div(assetReserves)
        .add(1);
      // OToken to burn = LP tokens to burn * OToken reserves / total LP supply
      const oTokenBurnAmount = lpBurnAmount.mul(oTokenReserves).div(totalLpSupply);
  
      log(`OToken burn amount : ${formatUnits(oTokenBurnAmount)}`);
  
      return { lpBurnAmount, oTokenBurnAmount };
    }
  
    // Calculate the OToken and asset token amounts from a withdrawAll
    async function calcWithdrawAllAmounts() {
      const { amoStrategy, gauge, pool } = fixture;
  
      // Get the reserves of the pool
      const { assetReserves, oTokenReserves } = await getPoolReserves();
      const strategyLpAmount = await gauge.balanceOf(
        amoStrategy.address
      );
      const totalLpSupply = await pool.totalSupply();
  
      // asset token to withdraw = asset token pool balance * strategy LP amount / total pool LP amount
      const assetTokenWithdrawAmount = assetReserves
        .mul(strategyLpAmount)
        .div(totalLpSupply);
      // OS to burn = OS pool balance * strategy LP amount / total pool LP amount
      const oTokenBurnAmount = oTokenReserves.mul(strategyLpAmount).div(totalLpSupply);
  
      log(`asset token withdraw amount : ${formatUnits(assetTokenWithdrawAmount)}`);
      log(`oToken burn amount    : ${formatUnits(oTokenBurnAmount)}`);
  
      return {
        assetTokenWithdrawAmount,
        oTokenBurnAmount,
      };
    }
  });
};

module.exports = {
  shouldBehaveLikeAlgebraAmoStrategy,
};