const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { isCI } = require("../helpers");

const log = require("../../utils/logger")("test:fork:algebra:amo");
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
const shouldBehaveLikeAlgebraAmoStrategy = (context) => {
  describe("ForkTest: Algebra AMO Strategy", function () {
    // Retry up to 3 times on CI
    this.retries(isCI ? 3 : 0);
    let fixture;
    describe("post deployment", () => {
      beforeEach(async () => {
        const { loadFixture } = await context();
        fixture = await loadFixture();
      });
      it("Should have constants and immutables set", async () => {
        const { amoStrategy, assetToken, oToken, pool, gauge, governor } = await context();
  
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
        const { assetToken, nick, amoStrategy } = await context();
  
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
        } = await context();
  
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
        } = await context();
  
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
  
    describe("with wS in the vault", () => {
      beforeEach(async () => {
        const { loadFixture } = await context({
          wsMintAmount: 5000000,
          depositToStrategy: false,
          balancePool: true,
        });
        fixture = await loadFixture();
      });
      it.only("Vault should deposit wS to AMO strategy", async function () {
        await assertDeposit(parseUnits("2000"));
      });
      it("Only vault can deposit wS to AMO strategy", async function () {
        const {
          amoStrategy,
          vaultSigner,
          strategist,
          timelock,
          nick,
          assetToken,
        } = await context();
  
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
      it("Only vault can deposit all wS to AMO strategy", async function () {
        const {
          amoStrategy,
          pool,
          vaultSigner,
          strategist,
          timelock,
          nick,
          assetToken,
        } = await context();
  
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
  
    // describe("with the strategy having OS and wS in a balanced pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 100000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
    //   });
    //   it("Vault should deposit wS", async function () {
    //     await assertDeposit(parseUnits("5000"));
    //   });
    //   it("Vault should be able to withdraw all", async () => {
    //     await assertWithdrawAll();
    //   });
    //   it("Vault should be able to withdraw all in SwapX Emergency", async () => {
    //     const { amoStrategy, swapXGauge, vaultSigner } = fixture;
  
    //     const gaugeOwner = await swapXGauge.owner();
    //     const ownerSigner = await impersonateAndFund(gaugeOwner);
    //     await swapXGauge.connect(ownerSigner).activateEmergencyMode();
    //     await assertWithdrawAll();
  
    //     // Try again when the strategy is empty
    //     await amoStrategy.connect(vaultSigner).withdrawAll();
    //   });
    //   it("Should fail to deposit zero wS", async () => {
    //     const { amoStrategy, vaultSigner, wS } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .deposit(assetToken.address, 0);
  
    //     await expect(tx).to.be.revertedWith("Must deposit something");
    //   });
    //   it("Should fail to deposit OS", async () => {
    //     const { amoStrategy, vaultSigner, oSonic } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .deposit(oSonic.address, parseUnits("1"));
  
    //     await expect(tx).to.be.revertedWith("Unsupported asset");
    //   });
    //   it("Should fail to withdraw zero wS", async () => {
    //     const { amoStrategy, vaultSigner, oSonicVault, wS } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .withdraw(oSonicVault.address, assetToken.address, 0);
  
    //     await expect(tx).to.be.revertedWith("Must withdraw something");
    //   });
    //   it("Should fail to withdraw OS", async () => {
    //     const { amoStrategy, vaultSigner, oSonic, oSonicVault } =
    //       fixture;
  
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .withdraw(oSonicVault.address, oSonic.address, parseUnits("1"));
  
    //     await expect(tx).to.be.revertedWith("Unsupported asset");
    //   });
    //   it("Should fail to withdraw to a user", async () => {
    //     const { amoStrategy, vaultSigner, wS, nick } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .withdraw(nick.address, assetToken.address, parseUnits("1"));
  
    //     await expect(tx).to.be.revertedWith("Only withdraw to vault allowed");
    //   });
    //   it("Vault should be able to withdraw all from empty strategy", async () => {
    //     const { amoStrategy, vaultSigner } = fixture;
    //     await assertWithdrawAll();
  
    //     // Now try again after all the assets have already been withdrawn
    //     const tx = await amoStrategy
    //       .connect(vaultSigner)
    //       .withdrawAll();
  
    //     // Check emitted events
    //     await expect(tx).to.not.emit(amoStrategy, "Withdrawal");
    //   });
    //   it("Vault should be able to partially withdraw", async () => {
    //     await assertWithdrawPartial(parseUnits("1000"));
    //   });
    //   it("Only vault can withdraw wS from AMO strategy", async function () {
    //     const { amoStrategy, oSonicVault, strategist, timelock, nick, wS } =
    //       fixture;
  
    //     for (const signer of [strategist, timelock, nick]) {
    //       const tx = amoStrategy
    //         .connect(signer)
    //         .withdraw(oSonicVault.address, assetToken.address, parseUnits("50"));
  
    //       await expect(tx).to.revertedWith("Caller is not the Vault");
    //     }
    //   });
    //   it("Only vault and governor can withdraw all WETH from AMO strategy", async function () {
    //     const { amoStrategy, strategist, timelock, nick } = fixture;
  
    //     for (const signer of [strategist, nick]) {
    //       const tx = amoStrategy.connect(signer).withdrawAll();
  
    //       await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
    //     }
  
    //     // Governor can withdraw all
    //     const tx = amoStrategy.connect(timelock).withdrawAll();
    //     await expect(tx).to.emit(amoStrategy, "Withdrawal");
    //   });
    //   it("Harvester can collect rewards", async () => {
    //     const {
    //       harvester,
    //       nick,
    //       amoStrategy,
    //       swapXGauge,
    //       swpx,
    //       strategist,
    //     } = fixture;
  
    //     const swpxBalanceBefore = await swpx.balanceOf(strategist.address);
  
    //     // Send some SWPx rewards to the gauge
    //     const distributorAddress = await swapXGauge.DISTRIBUTION();
    //     const distributorSigner = await impersonateAndFund(distributorAddress);
    //     const rewardAmount = parseUnits("1000");
    //     await setERC20TokenBalance(distributorAddress, swpx, rewardAmount);
    //     await swapXGauge
    //       .connect(distributorSigner)
    //       .notifyRewardAmount(swpx.address, rewardAmount);
  
    //     // Harvest the rewards
    //     // prettier-ignore
    //     const tx = await harvester
    //       .connect(nick)["harvestAndTransfer(address)"](amoStrategy.address);
  
    //     await expect(tx).to.emit(amoStrategy, "RewardTokenCollected");
  
    //     const swpxBalanceAfter = await swpx.balanceOf(strategist.address);
    //     log(
    //       `Rewards collected ${formatUnits(
    //         swpxBalanceAfter.sub(swpxBalanceBefore)
    //       )} SWPx`
    //     );
    //     expect(swpxBalanceAfter).to.gt(swpxBalanceBefore);
    //   });
    //   it("Attacker front-run deposit within range by adding wS to the pool", async () => {
    //     const { nick, oSonic, vaultSigner, amoStrategy, wS } =
    //       fixture;
  
    //     const attackerWsBalanceBefore = await assetToken.balanceOf(nick.address);
    //     const wsAmountIn = parseUnits("20000");
  
    //     const dataBeforeSwap = await snapData();
    //     logSnapData(
    //       dataBeforeSwap,
    //       `\nBefore attacker swaps ${formatUnits(
    //         wsAmountIn
    //       )} wS into the pool for OS`
    //     );
  
    //     // Attacker swaps a lot of wS for OS in the pool
    //     // This drops the pool's wS/OS price and increases the OS/wS price
    //     const osAmountOut = await poolSwapTokensIn(wS, wsAmountIn);
  
    //     const depositAmount = parseUnits("200000");
  
    //     const dataBeforeDeposit = await snapData();
    //     logSnapData(
    //       dataBeforeDeposit,
    //       `\nAfter attacker tilted pool and before strategist deposits ${formatUnits(
    //         depositAmount
    //       )} wS`
    //     );
  
    //     // Vault deposits wS to the strategy
    //     await wS
    //       .connect(vaultSigner)
    //       .transfer(amoStrategy.address, depositAmount);
    //     await amoStrategy
    //       .connect(vaultSigner)
    //       .deposit(assetToken.address, depositAmount);
  
    //     const dataAfterDeposit = await snapData();
    //     logSnapData(
    //       dataAfterDeposit,
    //       `\nAfter deposit of ${formatUnits(
    //         depositAmount
    //       )} wS to strategy and before attacker swaps ${formatUnits(
    //         osAmountOut
    //       )} OS back into the pool for wS`
    //     );
    //     await logProfit(dataBeforeSwap);
  
    //     // Attacker swaps the OS back for wS
    //     await poolSwapTokensIn(oSonic, osAmountOut);
  
    //     const dataAfterFinalSwap = await snapData();
    //     logSnapData(
    //       dataAfterFinalSwap,
    //       `\nAfter attacker swaps ${formatUnits(
    //         osAmountOut
    //       )} OS back into the pool for wS`
    //     );
    //     await logProfit(dataBeforeSwap);
  
    //     const attackerWsBalanceAfter = await assetToken.balanceOf(nick.address);
    //     log(
    //       `Attacker's profit ${formatUnits(
    //         attackerWsBalanceAfter.sub(attackerWsBalanceBefore)
    //       )} wS`
    //     );
    //   });
    //   describe("When attacker front-run by adding a lot of wS to the pool", () => {
    //     let attackerWsBalanceBefore;
    //     let dataBeforeSwap;
    //     let osAmountOut;
    //     beforeEach(async () => {
    //       const { nick, wS } = fixture;
  
    //       attackerWsBalanceBefore = await assetToken.balanceOf(nick.address);
    //       const wsAmountIn = parseUnits("10000000");
  
    //       dataBeforeSwap = await snapData();
    //       logSnapData(
    //         dataBeforeSwap,
    //         `\nBefore attacker swaps ${formatUnits(
    //           wsAmountIn
    //         )} wS into the pool for OS`
    //       );
  
    //       // Attacker swaps a lot of wS for OS in the pool
    //       // This drops the pool's wS/OS price and increases the OS/wS price
    //       osAmountOut = await poolSwapTokensIn(wS, wsAmountIn);
    //     });
    //     it("Strategist fails to deposit to strategy", async () => {
    //       await assertFailedDeposit(parseUnits("5000"), "price out of range");
    //     });
    //     it("Strategist fails to deposit all to strategy", async () => {
    //       await assertFailedDepositAll(parseUnits("5000"), "price out of range");
    //     });
    //     it("Strategist should withdraw from strategy with a profit", async () => {
    //       const {
    //         nick,
    //         oSonic,
    //         oSonicVault,
    //         vaultSigner,
    //         amoStrategy,
    //         wS,
    //       } = fixture;
    //       const withdrawAmount = parseUnits("4000");
  
    //       const dataBeforeWithdraw = await snapData();
    //       logSnapData(
    //         dataBeforeWithdraw,
    //         `\nBefore strategist withdraw ${formatUnits(withdrawAmount)} wS`
    //       );
  
    //       const tx = await amoStrategy
    //         .connect(vaultSigner)
    //         .withdraw(oSonicVault.address, assetToken.address, withdrawAmount);
  
    //       const dataAfterWithdraw = await snapData();
    //       logSnapData(
    //         dataAfterWithdraw,
    //         `\nAfter withdraw and before attacker swaps ${formatUnits(
    //           osAmountOut
    //         )} OS back into the pool for wS`
    //       );
    //       await logProfit(dataBeforeSwap);
  
    //       // Get how much OS was burnt
    //       const receipt = await tx.wait();
    //       const redeemEvent = receipt.events.find(
    //         (e) => e.event === "Withdrawal" && e.args._asset === oSonic.address
    //       );
    //       log(`\nWithdraw burnt ${formatUnits(redeemEvent.args._amount)} OS`);
  
    //       // Attacker swaps the OS back for wS
    //       await poolSwapTokensIn(oSonic, osAmountOut);
  
    //       const dataAfterFinalSwap = await snapData();
    //       logSnapData(
    //         dataAfterFinalSwap,
    //         "\nAfter attacker swaps OS into the pool for wS"
    //       );
    //       const profit = await logProfit(dataBeforeSwap);
    //       expect(profit, "vault profit").to.gt(0);
  
    //       const attackerWsBalanceAfter = await assetToken.balanceOf(nick.address);
    //       log(
    //         `Attacker's profit/loss ${formatUnits(
    //           attackerWsBalanceAfter.sub(attackerWsBalanceBefore)
    //         )} wS`
    //       );
    //     });
    //   });
    //   describe("When attacker front-run by adding a lot of OS to the pool", () => {
    //     const attackerBalanceBefore = {};
    //     let dataBeforeSwap;
    //     let wsAmountOut;
    //     beforeEach(async () => {
    //       const { nick, oSonic, oSonicVault, wS } = fixture;
  
    //       const osAmountIn = parseUnits("10000000");
    //       // Mint OS using wS
    //       await oSonicVault.connect(nick).mint(assetToken.address, osAmountIn, 0);
  
    //       attackerBalanceBefore.os = await oSonic.balanceOf(nick.address);
    //       attackerBalanceBefore.ws = await assetToken.balanceOf(nick.address);
  
    //       dataBeforeSwap = await snapData();
    //       logSnapData(
    //         dataBeforeSwap,
    //         `\nBefore attacker swaps ${formatUnits(
    //           osAmountIn
    //         )} OS into the pool for wS`
    //       );
  
    //       // Attacker swaps a lot of OS for wS in the pool
    //       // This increases the pool's wS/OS price and decreases the OS/wS price
    //       wsAmountOut = await poolSwapTokensIn(oSonic, osAmountIn);
    //     });
    //     it("Strategist fails to deposit to strategy", async () => {
    //       await assertFailedDeposit(parseUnits("5000"), "price out of range");
    //     });
    //     it("Strategist fails to deposit all to strategy", async () => {
    //       await assertFailedDepositAll(parseUnits("5000"), "price out of range");
    //     });
    //     it("Strategist should withdraw from strategy with a profit", async () => {
    //       const {
    //         nick,
    //         oSonic,
    //         oSonicVault,
    //         vaultSigner,
    //         amoStrategy,
    //         wS,
    //       } = fixture;
    //       const withdrawAmount = parseUnits("200");
  
    //       const dataBeforeWithdraw = await snapData();
    //       logSnapData(
    //         dataBeforeWithdraw,
    //         `\nBefore strategist withdraw ${formatUnits(withdrawAmount)} wS`
    //       );
  
    //       const tx = await amoStrategy
    //         .connect(vaultSigner)
    //         .withdraw(oSonicVault.address, assetToken.address, withdrawAmount);
  
    //       const dataAfterWithdraw = await snapData();
    //       logSnapData(
    //         dataAfterWithdraw,
    //         `\nAfter withdraw and before attacker swaps ${formatUnits(
    //           wsAmountOut
    //         )} wS back into the pool for OS`
    //       );
    //       await logProfit(dataBeforeSwap);
  
    //       // Get how much OS was burnt
    //       const receipt = await tx.wait();
    //       const redeemEvent = receipt.events.find(
    //         (e) => e.event === "Withdrawal" && e.args._asset === oSonic.address
    //       );
    //       log(`\nWithdraw burnt ${formatUnits(redeemEvent.args._amount)} OS`);
  
    //       // Attacker swaps the wS back for OS
    //       await poolSwapTokensIn(wS, wsAmountOut);
  
    //       const dataAfterFinalSwap = await snapData();
    //       logSnapData(
    //         dataAfterFinalSwap,
    //         "\nAfter attacker swaps wS into the pool for OS"
    //       );
    //       const profit = await logProfit(dataBeforeSwap);
    //       expect(profit, "vault profit").to.gt(0);
  
    //       const attackerBalanceAfter = {};
    //       attackerBalanceAfter.os = await oSonic.balanceOf(nick.address);
    //       attackerBalanceAfter.ws = await assetToken.balanceOf(nick.address);
    //       log(
    //         `Attacker's profit/loss ${formatUnits(
    //           attackerBalanceAfter.os.sub(attackerBalanceBefore.os)
    //         )} OS and ${formatUnits(
    //           attackerBalanceAfter.assetToken.sub(attackerBalanceBefore.ws)
    //         )} wS`
    //       );
    //     });
    //   });
    // });
  
    // describe("with a lot more OS in the pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 5000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //     poolAddOSAmount: 1000000,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
    //   });
    //   it("Vault should fail to deposit wS to AMO strategy", async function () {
    //     await assertFailedDeposit(parseUnits("5000"), "price out of range");
    //   });
    //   it("Vault should be able to withdraw all", async () => {
    //     await assertWithdrawAll();
    //   });
    //   it("Vault should be able to partially withdraw", async () => {
    //     await assertWithdrawPartial(parseUnits("4000"));
    //   });
    //   it("Strategist should swap a little assets to the pool", async () => {
    //     await assertSwapAssetsToPool(parseUnits("3"));
    //   });
    //   it("Strategist should swap enough wS to get the pool close to balanced", async () => {
    //     const { pool } = fixture;
    //     const { _reserve0: wsReserves, _reserve1: osReserves } =
    //       await pool.getReserves();
    //     // 5% of the extra OS
    //     const osAmount = osReserves.sub(wsReserves).mul(5).div(100);
    //     const wsAmount = osAmount.mul(wsReserves).div(osReserves);
    //     log(`OS amount: ${formatUnits(osAmount)}`);
    //     log(`wS amount: ${formatUnits(wsAmount)}`);
  
    //     await assertSwapAssetsToPool(wsAmount);
    //   });
    //   it("Strategist should swap a lot of assets to the pool", async () => {
    //     await assertSwapAssetsToPool(parseUnits("3000"));
    //   });
    //   it("Strategist should swap most of the wS owned by the strategy", async () => {
    //     // TODO calculate how much wS should be swapped to get the pool balanced
    //     await assertSwapAssetsToPool(parseUnits("4400"));
    //   });
    //   it("Strategist should fail to add more wS than owned by the strategy", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapAssetsToPool(parseUnits("2000000"));
  
    //     await expect(tx).to.be.revertedWith("Not enough LP tokens in gauge");
    //   });
    //   it("Strategist should fail to add more OS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // try swapping OS into the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapOTokensToPool(parseUnits("0.001"));
  
    //     await expect(tx).to.be.revertedWith("OTokens balance worse");
    //   });
    // });
  
    // describe("with a little more OS in the pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 20000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //     poolAddOSAmount: 5000,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
    //   });
    //   it("Vault should deposit wS to AMO strategy", async function () {
    //     await assertDeposit(parseUnits("12000"));
    //   });
    //   it("Vault should be able to withdraw all", async () => {
    //     await assertWithdrawAll();
    //   });
    //   it("Vault should be able to partially withdraw", async () => {
    //     await assertWithdrawPartial(parseUnits("1000"));
    //   });
    //   it("Strategist should swap a little assets to the pool", async () => {
    //     await assertSwapAssetsToPool(parseUnits("3"));
    //   });
    //   it("Strategist should swap enough wS to get the pool close to balanced", async () => {
    //     const { pool } = fixture;
    //     const { _reserve0: wsReserves, _reserve1: osReserves } =
    //       await pool.getReserves();
    //     // 50% of the extra OS in the pool gets close to balanced
    //     const osAmount = osReserves.sub(wsReserves).mul(50).div(100);
    //     const wsAmount = osAmount.mul(wsReserves).div(osReserves);
  
    //     await assertSwapAssetsToPool(wsAmount);
    //   });
    //   it("Strategist should fail to add too much wS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const dataBefore = await snapData();
    //     await logSnapData(dataBefore, "Before swapping assets to the pool");
  
    //     // try the extra OS in the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapAssetsToPool(parseUnits("5000"));
  
    //     await expect(tx).to.be.revertedWith("Assets overshot peg");
    //   });
    //   it("Strategist should fail to add zero wS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const tx = amoStrategy.connect(strategist).swapAssetsToPool(0);
  
    //     await expect(tx).to.be.revertedWith("Must swap something");
    //   });
    //   it("Strategist should fail to add more OS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // try swapping OS into the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapOTokensToPool(parseUnits("0.001"));
  
    //     await expect(tx).to.be.revertedWith("OTokens balance worse");
    //   });
    // });
  
    // describe("with a lot more wS in the pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 5000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //     poolAddwSAmount: 2000000,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
    //   });
    //   it("Vault should fail to deposit wS to strategy", async function () {
    //     await assertFailedDeposit(parseUnits("6000"), "price out of range");
    //   });
    //   it("Vault should be able to withdraw all", async () => {
    //     await assertWithdrawAll();
    //   });
    //   it("Vault should be able to partially withdraw", async () => {
    //     await assertWithdrawPartial(parseUnits("1000"));
    //   });
    //   it("Strategist should swap a little OS to the pool", async () => {
    //     const osAmount = parseUnits("0.3");
    //     await assertSwapOTokensToPool(osAmount, fixture);
    //   });
    //   it("Strategist should swap a lot of OS to the pool", async () => {
    //     const osAmount = parseUnits("5000");
    //     await assertSwapOTokensToPool(osAmount, fixture);
    //   });
    //   it("Strategist should get the pool close to balanced", async () => {
    //     const { pool } = fixture;
    //     const { _reserve0: wsReserves, _reserve1: osReserves } =
    //       await pool.getReserves();
    //     // 32% of the extra wS in the pool gets pretty close to balanced
    //     const osAmount = wsReserves.sub(osReserves).mul(32).div(100);
  
    //     await assertSwapOTokensToPool(osAmount);
    //   });
    //   it("Strategist should fail to add so much OS that is overshoots", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // try swapping wS into the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapOTokensToPool(parseUnits("999990"));
  
    //     await expect(tx).to.be.revertedWith("OTokens overshot peg");
    //   });
    //   it("Strategist should fail to add more wS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // try swapping wS into the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapAssetsToPool(parseUnits("0.0001"));
  
    //     await expect(tx).to.be.revertedWith("Assets balance worse");
    //   });
    // });
  
    // describe("with a little more wS in the pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 20000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //     poolAddwSAmount: 20000,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
    //   });
    //   it("Vault should deposit wS to AMO strategy", async function () {
    //     await assertDeposit(parseUnits("18000"));
    //   });
    //   it("Vault should be able to withdraw all", async () => {
    //     await assertWithdrawAll();
    //   });
    //   it("Vault should be able to partially withdraw", async () => {
    //     await assertWithdrawPartial(parseUnits("1000"));
    //   });
    //   it("Strategist should swap a little OS to the pool", async () => {
    //     const osAmount = parseUnits("8");
    //     await assertSwapOTokensToPool(osAmount, fixture);
    //   });
    //   it("Strategist should get the pool close to balanced", async () => {
    //     const { pool } = fixture;
  
    //     const { _reserve0: wsReserves, _reserve1: osReserves } =
    //       await pool.getReserves();
    //     // 50% of the extra wS in the pool gets pretty close to balanced
    //     const osAmount = wsReserves.sub(osReserves).mul(50).div(100);
  
    //     await assertSwapOTokensToPool(osAmount, fixture);
    //   });
    //   it("Strategist should fail to add zero OS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const tx = amoStrategy.connect(strategist).swapOTokensToPool(0);
  
    //     await expect(tx).to.be.revertedWith("Must swap something");
    //   });
    //   it("Strategist should fail to add too much OS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // Add OS to the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapOTokensToPool(parseUnits("11000"));
  
    //     await expect(tx).to.be.revertedWith("OTokens overshot peg");
    //   });
    //   it("Strategist should fail to add more wS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     // try swapping wS into the pool
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapAssetsToPool(parseUnits("0.0001"));
  
    //     await expect(tx).to.be.revertedWith("Assets balance worse");
    //   });
    // });
  
    // describe("with the strategy owning a small percentage of the pool", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 5000,
    //     depositToStrategy: true,
    //     balancePool: true,
    //   });
    //   let dataBefore;
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
  
    //     const { nick, wS, oSonic, oSonicVault, pool } = fixture;
  
    //     // Other users adds a lot more liquidity to the pool
    //     const bigAmount = parseUnits("1000000");
    //     // transfer wS to the pool
    //     await assetToken.connect(nick).transfer(pool.address, bigAmount);
    //     // Mint OS with wS
    //     await oSonicVault.connect(nick).mint(assetToken.address, bigAmount.mul(5), 0);
    //     // transfer OS to the pool
    //     await oSonic.connect(nick).transfer(pool.address, bigAmount);
    //     // mint pool LP tokens
    //     await pool.connect(nick).mint(nick.address);
  
    //     dataBefore = await snapData();
    //     await logSnapData(dataBefore);
    //   });
    //   it("a lot of OS is swapped into the pool", async () => {
    //     const { oSonic, amoStrategy, wS } = fixture;
  
    //     // Swap OS into the pool and wS out
    //     await poolSwapTokensIn(oSonic, parseUnits("1005000"));
  
    //     await logSnapData(await snapData(), "\nAfter swapping OS into the pool");
  
    //     // Assert the strategy's balance
    //     expect(
    //       await amoStrategy.checkBalance(assetToken.address),
    //       "Strategy's check balance"
    //     ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
  
    //     // Swap wS into the pool and OS out
    //     await poolSwapTokensIn(wS, parseUnits("2000000"));
  
    //     await logSnapData(await snapData(), "\nAfter swapping wS into the pool");
  
    //     // Assert the strategy's balance
    //     expect(
    //       await amoStrategy.checkBalance(assetToken.address),
    //       "Strategy's check balance"
    //     ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
    //   });
    //   it("a lot of wS is swapped into the pool", async () => {
    //     const { amoStrategy, oSonic, wS } = fixture;
  
    //     // Swap wS into the pool and OS out
    //     await poolSwapTokensIn(wS, parseUnits("1006000"));
  
    //     await logSnapData(await snapData(), "\nAfter swapping wS into the pool");
  
    //     // Assert the strategy's balance
    //     expect(
    //       await amoStrategy.checkBalance(assetToken.address),
    //       "Strategy's check balance"
    //     ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
  
    //     // Swap OS into the pool and wS out
    //     await poolSwapTokensIn(oSonic, parseUnits("1005000"));
  
    //     await logSnapData(await snapData(), "\nAfter swapping OS into the pool");
  
    //     // Assert the strategy's balance
    //     expect(
    //       await amoStrategy.checkBalance(assetToken.address),
    //       "Strategy's check balance"
    //     ).to.withinRange(dataBefore.stratBalance, dataBefore.stratBalance.add(1));
    //   });
    // });
  
    // describe("with an insolvent vault", () => {
    //   const loadFixture = createFixtureLoader(swapXAMOFixture, {
    //     wsMintAmount: 5000000,
    //     depositToStrategy: false,
    //   });
    //   beforeEach(async () => {
    //     fixture = await loadFixture();
  
    //     const { oSonicVault, vaultSigner, amoStrategy, wS } = fixture;
  
    //     // Deposit a little to the strategy
    //     const littleAmount = parseUnits("100");
    //     await wS
    //       .connect(vaultSigner)
    //       .transfer(amoStrategy.address, littleAmount);
    //     await amoStrategy
    //       .connect(vaultSigner)
    //       .deposit(assetToken.address, littleAmount);
  
    //     const totalAssets = await oSonicVault.totalValue();
    //     // Calculate a 0.21% (21 basis points) loss
    //     const lossAmount = totalAssets.mul(21).div(10000);
    //     await assetToken.connect(vaultSigner).transfer(addresses.dead, lossAmount);
    //     expect(
    //       await assetToken.balanceOf(oSonicVault.address),
    //       "Must have enough wS in vault to make insolvent"
    //     ).to.gte(lossAmount);
    //   });
    //   it("Should fail to deposit", async () => {
    //     const { vaultSigner, amoStrategy, wS } = fixture;
  
    //     // Vault calls deposit on the strategy
    //     const depositAmount = parseUnits("10");
    //     await wS
    //       .connect(vaultSigner)
    //       .transfer(amoStrategy.address, depositAmount);
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .deposit(assetToken.address, depositAmount);
  
    //     await expect(tx).to.be.revertedWith("Protocol insolvent");
    //   });
    //   it("Should fail to withdraw", async () => {
    //     const { oSonicVault, vaultSigner, amoStrategy, wS } = fixture;
  
    //     // Vault withdraws from the strategy
    //     const tx = amoStrategy
    //       .connect(vaultSigner)
    //       .withdraw(oSonicVault.address, assetToken.address, parseUnits("10"));
  
    //     await expect(tx).to.be.revertedWith("Protocol insolvent");
    //   });
    //   it("Should withdraw all", async () => {
    //     const { vaultSigner, amoStrategy } = fixture;
  
    //     // Vault withdraw alls from the strategy
    //     const tx = amoStrategy.connect(vaultSigner).withdrawAll();
  
    //     await expect(tx).to.not.revertedWith("Protocol insolvent");
    //   });
    //   it("Should fail to swap assets to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapAssetsToPool(parseUnits("10"));
  
    //     await expect(tx).to.be.revertedWith("Protocol insolvent");
    //   });
    //   it("Should fail to swap OS to the pool", async () => {
    //     const { amoStrategy, strategist } = fixture;
  
    //     const tx = amoStrategy
    //       .connect(strategist)
    //       .swapOTokensToPool(parseUnits("10"));
  
    //     await expect(tx).to.be.revertedWith("Protocol insolvent");
    //   });
    // });
  
    const poolSwapTokensIn = async (tokenIn, amountIn) => {
      const { nick, pool, wS } = fixture;
      const amountOut = await pool.getAmountOut(amountIn, tokenIn.address);
      await tokenIn.connect(nick).transfer(pool.address, amountIn);
      if (tokenIn.address == assetToken.address) {
        await pool.swap(0, amountOut, nick.address, "0x");
      } else {
        await pool.swap(amountOut, 0, nick.address, "0x");
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
        await context();
  
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
      const { oToken, vault, amoStrategy, assetToken } = await context();
  
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
      const { oToken, vault, amoStrategy, pool, gauge, assetToken } =
        await context();
  
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
      if (delta.vaultAssetTokenBalance != undefined) {
          expect(await assetToken.balanceOf(vault.address)).to.equal(
          dataBefore.vaultAssetTokenBalance.add(delta.vaultAssetTokenBalance),
          "Vault's assetToken balance"
        );
      }
  
      // Check the pool's reserves
      if (delta.reserves != undefined) {
        const { assetTokenReserves, oTokenReserves } = await getPoolReserves();
  
        // If the asset reserves delta is a function, call it to check the asset token reserves
        if (typeof delta.reserves.assetToken == "function") {
          // Call test function to check the asset token reserves
          delta.reserves.assetToken(assetTokenReserves);
        } else {
          expect(assetTokenReserves, "assetToken reserves").to.equal(
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
      } = await context();
  
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
      
      console.log("HERE 1");
      // Check emitted events
      await expect(tx).to.emit(amoStrategy, "Deposit")
        .withArgs(assetToken.address, pool.address, assetDepositAmount);
      // await expect(tx).to.emit(amoStrategy, "Deposit")
      //   .withArgs(oToken.address, pool.address, oTokenMintAmount);
  
      console.log("HERE 2");
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
      
      console.log("HERE 3");
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oToken.balanceOf(amoStrategy.address),
        "Strategy's OToken balance"
      ).to.equal(0);
    }
  
    async function assertFailedDeposit(assetDepositAmount, errorMessage) {
      const { wS, vaultSigner, amoStrategy } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "\nBefore depositing wS to strategy");
  
      // Vault transfers wS to strategy
      await wS
        .connect(vaultSigner)
        .transfer(amoStrategy.address, assetDepositAmount);
  
      // Vault calls deposit on the strategy
      const tx = amoStrategy
        .connect(vaultSigner)
        .deposit(assetToken.address, assetDepositAmount);
  
      await expect(tx, "deposit to strategy").to.be.revertedWith(errorMessage);
    }
  
    async function assertFailedDepositAll(assetDepositAmount, errorMessage) {
      const { wS, vaultSigner, amoStrategy } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "\nBefore depositing all wS to strategy");
  
      // Vault transfers wS to strategy
      await wS
        .connect(vaultSigner)
        .transfer(amoStrategy.address, assetDepositAmount);
  
      // Vault calls depositAll on the strategy
      const tx = amoStrategy.connect(vaultSigner).depositAll();
  
      await expect(tx, "depositAll to strategy").to.be.revertedWith(errorMessage);
    }
  
    async function assertWithdrawAll() {
      const { amoStrategy, pool, oSonic, vaultSigner, wS } =
        fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore);
  
      const { osBurnAmount, wsWithdrawAmount } = await calcWithdrawAllAmounts();
  
      // Now try to withdraw all the wS from the strategy
      const tx = await amoStrategy.connect(vaultSigner).withdrawAll();
  
      await logSnapData(await snapData(), "\nAfter full withdraw");
      await logProfit(dataBefore);
  
      // Check emitted events
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(assetToken.address, pool.address, wsWithdrawAmount);
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(oSonic.address, pool.address, osBurnAmount);
  
      // Calculate the value of the wS and OS tokens removed from the pool if the pool was balanced
      const withdrawValue = calcReserveValue({
        ws: wsWithdrawAmount,
        os: osBurnAmount,
      });
  
      await assertChangedData(dataBefore, {
        stratBalance: withdrawValue.mul(-1),
        osSupply: osBurnAmount.mul(-1),
        reserves: { ws: wsWithdrawAmount.mul(-1), os: osBurnAmount.mul(-1) },
        vaultWSBalance: wsWithdrawAmount,
        stratGaugeBalance: dataBefore.stratGaugeBalance.mul(-1),
      });
  
      expect(
        wsWithdrawAmount.add(osBurnAmount),
        "wS withdraw and OS burnt >= strategy balance"
      ).to.gte(dataBefore.stratBalance);
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oSonic.balanceOf(amoStrategy.address),
        "Strategy's OS balance"
      ).to.equal(0);
    }
  
    async function assertWithdrawPartial(wsWithdrawAmount) {
      const {
        amoStrategy,
        oSonic,
        pool,
        oSonicVault,
        vaultSigner,
        wS,
      } = fixture;
  
      const dataBefore = await snapData();
  
      const { lpBurnAmount, osBurnAmount } = await calcOSWithdrawAmount(
        wsWithdrawAmount
      );
  
      // Now try to withdraw the wS from the strategy
      const tx = await amoStrategy
        .connect(vaultSigner)
        .withdraw(oSonicVault.address, assetToken.address, wsWithdrawAmount);
  
      await logSnapData(
        await snapData(),
        `\nAfter withdraw of ${formatUnits(wsWithdrawAmount)}`
      );
      await logProfit(dataBefore);
  
      // Check emitted events
      await expect(tx)
        .to.emit(amoStrategy, "Withdrawal")
        .withArgs(assetToken.address, pool.address, wsWithdrawAmount);
      await expect(tx).to.emit(amoStrategy, "Withdrawal").withNamedArgs({
        _asset: oSonic.address,
        _pToken: pool.address,
      });
  
      // Calculate the value of the wS and OS tokens removed from the pool if the pool was balanced
      const withdrawValue = calcReserveValue({
        ws: wsWithdrawAmount,
        os: osBurnAmount,
      });
  
      await assertChangedData(dataBefore, {
        stratBalance: withdrawValue.mul(-1),
        osSupply: osBurnAmount.mul(-1),
        reserves: {
          ws: (actualWsReserve) => {
            const expectedWsReserves =
              dataBefore.reserves.assetToken.sub(wsWithdrawAmount);
  
            expect(actualWsReserve).to.withinRange(
              expectedWsReserves.sub(50),
              expectedWsReserves,
              "wS reserves"
            );
          },
          os: osBurnAmount.mul(-1),
        },
        vaultWSBalance: wsWithdrawAmount,
        gaugeSupply: lpBurnAmount.mul(-1),
      });
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oSonic.balanceOf(amoStrategy.address),
        "Strategy's OS balance"
      ).to.equal(0);
    }
  
    async function assertSwapAssetsToPool(wsAmount) {
      const { oSonic, amoStrategy, pool, strategist, wS } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(
        dataBefore,
        `Before swapping ${formatUnits(wsAmount)} wS into the pool`
      );
  
      const { lpBurnAmount: expectedLpBurnAmount, osBurnAmount: osBurnAmount1 } =
        await calcOSWithdrawAmount(wsAmount);
      // TODO this is not accurate as the liquidity needs to be removed first
      const osBurnAmount2 = await pool.getAmountOut(wsAmount, assetToken.address);
      const osBurnAmount = osBurnAmount1.add(osBurnAmount2);
  
      // Swap wS to the pool and burn the received OS from the pool
      const tx = await amoStrategy
        .connect(strategist)
        .swapAssetsToPool(wsAmount);
  
      await logSnapData(await snapData(), "\nAfter swapping assets to the pool");
      await logProfit(dataBefore);
  
      // Check emitted event
      await expect(tx).to.emittedEvent("SwapAssetsToPool", [
        (actualWsAmount) => {
          expect(actualWsAmount).to.withinRange(
            wsAmount.sub(1),
            wsAmount.add(1),
            "SwapAssetsToPool event wsAmount"
          );
        },
        expectedLpBurnAmount,
        (actualOsBurnAmount) => {
          // TODO this can be tightened once osBurnAmount is more accurately calculated
          expect(actualOsBurnAmount).to.approxEqualTolerance(
            osBurnAmount,
            10,
            "SwapAssetsToPool event osBurnt"
          );
        },
      ]);
  
      await assertChangedData(
        dataBefore,
        {
          // stratBalance: osBurnAmount.mul(-1),
          vaultWSBalance: 0,
          stratGaugeBalance: 0,
        },
        fixture
      );
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oSonic.balanceOf(amoStrategy.address),
        "Strategy's OS balance"
      ).to.equal(0);
    }
  
    async function assertSwapOTokensToPool(osAmount) {
      const { oSonic, pool, amoStrategy, strategist } = fixture;
  
      const dataBefore = await snapData();
      await logSnapData(dataBefore, "Before swapping OTokens to the pool");
  
      // Mint OS and swap into the pool, then mint more OS to add with the wS swapped out
      const tx = await amoStrategy
        .connect(strategist)
        .swapOTokensToPool(osAmount);
  
      // Check emitted event
      await expect(tx)
        .emit(amoStrategy, "SwapOTokensToPool")
        .withNamedArgs({ oTokenMinted: osAmount });
  
      await logSnapData(await snapData(), "\nAfter swapping OTokens to the pool");
      await logProfit(dataBefore);
  
      await assertChangedData(
        dataBefore,
        {
          // stratBalance: osBurnAmount.mul(-1),
          vaultWSBalance: 0,
          stratGaugeBalance: 0,
        },
        fixture
      );
  
      expect(
        await pool.balanceOf(amoStrategy.address),
        "Strategy's pool LP balance"
      ).to.equal(0);
      expect(
        await oSonic.balanceOf(amoStrategy.address),
        "Strategy's OS balance"
      ).to.equal(0);
    }
  
    // Calculate the minted OS amount for a deposit
    async function calcOTokenMintAmount(assetDepositAmount) {
      const { pool } = await context();
      
      const { assetReserves, oTokenReserves } = await getPoolReserves();
  
      const oTokenMintAmount = assetDepositAmount.mul(oTokenReserves).div(assetReserves);
      log(`OToken mint amount      : ${formatUnits(oTokenMintAmount)}`);
  
      const lpTotalSupply = await pool.totalSupply();
      const lpMintAmount = assetDepositAmount.mul(lpTotalSupply).div(assetReserves);
  
      return { lpMintAmount, oTokenMintAmount };
    }
    
    async function getPoolReserves() {
      const { pool, oTokenPoolIndex } = await context();

      let assetReserves, oTokenReserves;
      // Get the reserves of the pool
      const { _reserve0, _reserve1 } = await pool.getReserves();
      
      assetReserves = oTokenPoolIndex === 0 ? _reserve1 : _reserve0;
      oTokenReserves = oTokenPoolIndex === 0 ? _reserve0 : _reserve1;

      return { assetReserves, oTokenReserves };
    }
    // Calculate the amount of OS burnt from a withdraw
    async function calcOSWithdrawAmount(wsWithdrawAmount) {
      const { pool } = fixture;
  
      // Get the reserves of the pool
      const { _reserve0: wsReserves, _reserve1: osReserves } =
        await pool.getReserves();
  
      // lp tokens to burn = wS withdrawn * total LP supply / wS pool balance
      const totalLpSupply = await pool.totalSupply();
      const lpBurnAmount = wsWithdrawAmount
        .mul(totalLpSupply)
        .div(wsReserves)
        .add(1);
      // OS to burn = LP tokens to burn * OS reserves / total LP supply
      const osBurnAmount = lpBurnAmount.mul(osReserves).div(totalLpSupply);
  
      log(`OS burn amount : ${formatUnits(osBurnAmount)}`);
  
      return { lpBurnAmount, osBurnAmount };
    }
  
    // Calculate the OS and wS amounts from a withdrawAll
    async function calcWithdrawAllAmounts() {
      const { amoStrategy, swapXGauge, pool } = fixture;
  
      // Get the reserves of the pool
      const { _reserve0: wsReserves, _reserve1: osReserves } =
        await pool.getReserves();
      const strategyLpAmount = await swapXGauge.balanceOf(
        amoStrategy.address
      );
      const totalLpSupply = await pool.totalSupply();
  
      // wS to withdraw = wS pool balance * strategy LP amount / total pool LP amount
      const wsWithdrawAmount = wsReserves
        .mul(strategyLpAmount)
        .div(totalLpSupply);
      // OS to burn = OS pool balance * strategy LP amount / total pool LP amount
      const osBurnAmount = osReserves.mul(strategyLpAmount).div(totalLpSupply);
  
      log(`wS withdraw amount : ${formatUnits(wsWithdrawAmount)}`);
      log(`OS burn amount    : ${formatUnits(osBurnAmount)}`);
  
      return {
        wsWithdrawAmount,
        osBurnAmount,
      };
    }
  });
};

module.exports = {
  shouldBehaveLikeAlgebraAmoStrategy,
};