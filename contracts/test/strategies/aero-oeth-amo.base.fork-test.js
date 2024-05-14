const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { units, oethUnits, isCI } = require("../helpers");
const { aeroOETHAMOFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");
const { BigNumber, ethers } = require("ethers");

const log = require("../../utils/logger")("test:fork:aero-oeth:metapool");

describe("ForkTest: OETH AMO Aerodrome Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { aerodromeEthStrategy, oethReserveIndex, wethReserveIndex } =
        fixture;

      expect(await aerodromeEthStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );
      expect(await aerodromeEthStrategy.ETH_ADDRESS()).to.equal(addresses.ETH);

      expect(await aerodromeEthStrategy.aeroRouterAddress()).to.equal(
        addresses.base.aeroRouterAddress
      );
      expect(await aerodromeEthStrategy.aeroFactoryAddress()).to.equal(
        addresses.base.aeroFactoryAddress
      );
      expect((await aerodromeEthStrategy.wethCoinIndex()).toString()).to.equal(
        wethReserveIndex == "_reserve1" ? "1" : "0"
      );
      expect((await aerodromeEthStrategy.oethCoinIndex()).toString()).to.equal(
        oethReserveIndex == "_reserve1" ? "1" : "0"
      );
    });
    it("Should calculate the correct LP Price", async () => {
      const { aerodromeEthStrategy } = fixture;

      const lpPrice = await calcLPTokenPrice(fixture);

      expect(await aerodromeEthStrategy.getLPTokenPrice()).to.equal(
        BigNumber.from(ethers.constants.WeiPerEther.mul(lpPrice))
      );
    });
    it("Should be able to check balance", async () => {
      const { weth, josh, aerodromeEthStrategy } = fixture;

      const balance = await aerodromeEthStrategy.checkBalance(weth.address);
      log(`check balance ${balance}`);
      expect(balance).gt(0);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await aerodromeEthStrategy
        .connect(josh)
        .populateTransaction.checkBalance(weth.address);
      await josh.sendTransaction(tx);
    });
  });
  describe("with some WETH in the vault", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Vault should deposit some WETH to AMO strategy", async function () {
      const {
        aerodromeEthStrategy,
        oeth,
        pool,
        weth,
        josh,
        oethVault,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      const wethDepositAmount = await units("1000", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      const {
        oethMintAmount: oethMintAmount,
        wethDeposited,
        aeroBalances,
      } = await calcOethMintAmount(fixture, wethDepositAmount);
      const oethSupplyBefore = await oeth.totalSupply();

      let vaultSigner = await impersonateAndFund(oethVault.address, "2");

      log("Before deposit to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
      });
      const tx = await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      const receipt = await tx.wait();

      log("After deposit to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      //   // Check the ETH and OETH balances in the Aero sAMM Pool
      //   const aeroBalancesAfter = await pool.getReserves();
      //   expect(
      //     aeroBalancesAfter[wethReserveIndex].toString()
      //   ).to.approxEqualTolerance(
      //     aeroBalances[wethReserveIndex].add(wethDeposited),
      //     0.1 // 1% or 10 basis point
      //   );
      //   expect(
      //     aeroBalancesAfter[oethReserveIndex].toString()
      //   ).to.approxEqualTolerance(
      //     aeroBalances[oethReserveIndex].add(oethMintAmount),
      //     0.1 // 1% or 10 basis point
      //   );

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        0.1 // 1% or 10 basis point
      );
    });
    it("Only vault can deposit some WETH to AMO strategy", async function () {
      const { aerodromeEthStrategy, josh, weth, strategist, timelock } =
        fixture;

      const depositAmount = await units("50", weth);

      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      // for (let signer of [strategist, timelock, josh]) { TODO: Check why this fails

      for (let signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = aerodromeEthStrategy
        .connect(josh)
        .deposit(weth.address, depositAmount);

      await expect(tx).to.revertedWith("Caller is not the Vault");
    });
    it("Only vault can deposit all WETH to AMO strategy", async function () {
      const {
        aerodromeEthStrategy,
        pool,
        josh,
        weth,
        strategist,
        timelock,
        oethVaultSigner,
      } = fixture;

      const depositAmount = parseUnits("50");
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      let tx = aerodromeEthStrategy
        .connect(josh)
        .deposit(weth.address, depositAmount);
      await expect(tx).to.revertedWith("Caller is not the Vault");

      // for (const signer of [strategist, timelock, josh]) { -> Check why this fails
      for (const signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
      tx = await aerodromeEthStrategy.connect(oethVaultSigner).depositAll();
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withNamedArgs({ _asset: weth.address, _pToken: pool.address });
    });
  });
  describe("with the strategy having some OETH and WETH in the Pool", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture({
        wethMintAmount: 5000,
        depositToStrategy: true,
        balancePool: true,
      });
    });
    it("Vault should be able to withdraw all", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVaultSigner,
        weth,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      const {
        oethBurnAmount,
        ethWithdrawAmount,
        aeroBalances: aeroBalancesBefore,
        strategyOethBalanceBefore,
        strategyWethBalanceBefore,
      } = await calcWithdrawAllAmounts(fixture);

      const oethSupplyBefore = await oeth.totalSupply();

      log("Before withdraw all from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fixture: JSON.stringify(fixture),
      });

      // Now try to withdraw all the WETH from the strategy
      const tx = await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      const receipt = await tx.wait();

      log("After withdraw all from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fromBlock: receipt.blockNumber - 1,
        fixture: JSON.stringify(fixture),
      });

      // Check emitted events
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(weth.address, pool.address, ethWithdrawAmount);
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(oeth.address, pool.address, oethBurnAmount);

      // Check the ETH and OETH balances in the Aero sAMM Metapool
      const aeroBalancesAfter = await pool.getReserves();
      expect(aeroBalancesAfter[wethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[wethReserveIndex].sub(
          ethWithdrawAmount.sub(strategyWethBalanceBefore)
        ),
        0.05 // 0.05% or 5 basis point
      );
      expect(aeroBalancesAfter[oethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[oethReserveIndex].sub(
          oethBurnAmount.sub(strategyOethBalanceBefore)
        ),
        0.05 // 0.05%
      );

      // Check the OETH total supply decrease
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.05 // 0.01% or 5 basis point
      );
    });
    it("Vault should be able to withdraw some", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVaultSigner,
        weth,
        oethVault,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      const withdrawAmount = oethUnits("1000");

      const { oethBurnAmount, aeroBalances: aeroBalancesBefore } =
        await calcOethWithdrawAmount(fixture, withdrawAmount);
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      log("Before withdraw from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fixture: JSON.stringify(fixture),
      });

      // Now try to withdraw the WETH from the strategy
      const tx = await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, withdrawAmount);

      const receipt = await tx.wait();

      log("After withdraw from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fromBlock: receipt.blockNumber - 1,
        fixture: JSON.stringify(fixture),
      });
      // Check emitted events
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(weth.address, pool.address, withdrawAmount);
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withNamedArgs({ _asset: oeth.address, _pToken: pool.address });

      // Check the ETH and OETH balances in the aero pool
      const aeroBalancesAfter = await pool.getReserves();
      expect(aeroBalancesAfter[wethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[wethReserveIndex].sub(withdrawAmount),
        0.5 // 0.5% or 50 basis point
      );
      expect(aeroBalancesAfter[oethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[oethReserveIndex].sub(oethBurnAmount),
        0.5 // 0.5% or 50 basis point
      );

      // Check the OETH total supply decrease
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.5 // 0.5% or 50 basis point
      );

      // Check the WETH balance in the Vault
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some WETH from AMO strategy", async function () {
      const {
        aerodromeEthStrategy,
        oethVault,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;
      //  for (const signer of [strategist, timelock, josh]) { <-TODO: Check why this reverts
      for (const signer of [josh]) {
        const tx = aerodromeEthStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all WETH from AMO strategy", async function () {
      const { aerodromeEthStrategy, josh, governor } = fixture;

      // for (const signer of [strategist, josh]) {  <- TODO: Check why this reverts
      for (const signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = aerodromeEthStrategy.connect(governor).withdrawAll();
      await expect(tx).to.emit(aerodromeEthStrategy, "Withdrawal");
    });
  });
  describe("with pool rebalance", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Should be able to mint OETH and send received weth to recipient", async function () {
      const { oeth, weth, josh, aeroRouter, aerodromeEthStrategy, oethVault } =
        fixture;

      let joshWethBalanceBefore = await weth.balanceOf(josh.address);
      let netOEthMintedBefore = await oethVault.netOusdMintedForStrategy();

      const wethToSwap = parseUnits("1000");
      await weth.connect(josh).approve(aeroRouter.address, wethToSwap);

      // Perform swap to imbalance the pool
      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          wethToSwap,
          0,
          [
            [
              weth.address,
              oeth.address,
              true,
              addresses.base.aeroFactoryAddress,
            ],
          ],
          josh.address,
          parseInt(Date.now() / 1000) + 5 * 360
        );

      // Rebalance the pool
      const { tokenIn, amountIn } = await getParamsForPoolRebalance(fixture);

      if (tokenIn == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn);
      }
      log("Before rebalancing pool");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
      });
      // Rebalance pool
      tx = await aerodromeEthStrategy
        .connect(josh)
        .swapAndRebalancePool(amountIn, 0, tokenIn, josh.address);

      const receipt = await tx.wait();

      log("After rebalancing pool");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      let joshWethBalanceAfter = await weth.balanceOf(josh.address);
      let netOEthMintedAfter = await oethVault.netOusdMintedForStrategy();

      expect(joshWethBalanceAfter).to.gt(joshWethBalanceBefore);
      expect(netOEthMintedAfter).to.gt(netOEthMintedBefore);
    });
    it("Should be able to burn OETH when rebalancing", async function () {
      const { oethVault } = fixture;

      let netOEthMintedBefore = await oethVault.netOusdMintedForStrategy();

      await rebalancePool(fixture);

      let netOEthMintedAfter = await oethVault.netOusdMintedForStrategy();

      expect(netOEthMintedAfter).to.lt(netOEthMintedBefore);
    });

    it("Should not rebalance pool by making the WETH reserve > OETH reserve", async function () {
      const { oeth, weth, josh, aeroRouter, aerodromeEthStrategy } = fixture;
      const oethToSwap = parseUnits("1000");
      await oeth.connect(josh).approve(aeroRouter.address, oethToSwap);

      // Perform swap to imbalance the pool
      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          oethToSwap,
          0,
          [
            [
              oeth.address,
              weth.address,
              true,
              addresses.base.aeroFactoryAddress,
            ],
          ],
          josh.address,
          parseInt(Date.now() / 1000) + 5 * 360
        );

      // Try to make the pool balance even worse (should revert)
      const { tokenIn, amountIn } = await getParamsForPoolRebalance(
        fixture,
        49,
        51
      );
      if (tokenIn == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn);
      }

      // Rebalance pool should revert with error message
      tx = aerodromeEthStrategy
        .connect(josh)
        .swapAndRebalancePool(amountIn, 0, tokenIn, josh.address);
      await expect(tx).to.revertedWith("WETH reserves exceeds OETH");
    });
    it("Should not rebalance pool more than allowed threshold", async function () {
      const { oeth, weth, josh, aeroRouter, aerodromeEthStrategy } = fixture;
      const oethToSwap = parseUnits("1000");
      await oeth.connect(josh).approve(aeroRouter.address, oethToSwap);

      // Perform swap to imbalance the pool
      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          oethToSwap,
          0,
          [
            [
              oeth.address,
              weth.address,
              true,
              addresses.base.aeroFactoryAddress,
            ],
          ],
          josh.address,
          parseInt(Date.now() / 1000) + 5 * 360
        );

      // Try to rebalance the pool in a 55:45 ratio (should go through)
      const { tokenIn, amountIn } = await getParamsForPoolRebalance(
        fixture,
        55,
        45
      );

      if (tokenIn == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn);
      }

      await aerodromeEthStrategy
        .connect(josh)
        .swapAndRebalancePool(amountIn, 0, tokenIn, josh.address);
      // Try to make the pool balance even worse (should revert)
      const { tokenIn: tokenIn2, amountIn: amountIn2 } =
        await getParamsForPoolRebalance(fixture, 57, 43);
      if (tokenIn2 == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn2);
      }

      // Rebalance pool should revert with error message
      tx = aerodromeEthStrategy
        .connect(josh)
        .swapAndRebalancePool(amountIn2, 0, tokenIn2, josh.address);
      await expect(tx).to.revertedWith("Pool imbalance worsened");
    });
    it("Vault should be able to deposit some WETH to AMO strategy after rebalancing", async function () {
      const { aerodromeEthStrategy, oeth, pool, weth, josh, oethVault } =
        fixture;

      await rebalancePool(fixture);
      const wethDepositAmount = await units("100", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);
      let vaultSigner = await impersonateAndFund(oethVault.address, "2");

      const {
        oethMintAmount: oethMintAmount,
        wethDeposited,
        aeroBalances,
      } = await calcOethMintAmount(fixture, wethDepositAmount);
      const oethSupplyBefore = await oeth.totalSupply();

      log("Before deposit to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
      });

      tx = await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      const receipt = await tx.wait();

      log("After deposit to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      // Check emitted events
      await expect(tx).to.emit(aerodromeEthStrategy, "Deposit");
      await expect(tx).to.emit(aerodromeEthStrategy, "Deposit");

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        0.01 // 0.01% or 1 basis point
      );
    });

    it("Vault should be able to deposit all WETH to AMO strategy after rebalancing", async function () {
      const {
        aerodromeEthStrategy,
        pool,
        josh,
        weth,

        oethVaultSigner,
      } = fixture;

      await rebalancePool(fixture);

      const depositAmount = parseUnits("50");
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      log("Before depositAll to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
      });

      tx = await aerodromeEthStrategy.connect(oethVaultSigner).depositAll();

      const receipt = await tx.wait();

      log("After depositAll to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withNamedArgs({ _asset: weth.address, _pToken: pool.address });
    });
    it("Vault should be able to withdraw some after rebalancing", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVaultSigner,
        weth,
        oethVault,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      await rebalancePool(fixture);

      const withdrawAmount = oethUnits("1000");

      const { oethBurnAmount, aeroBalances: aeroBalancesBefore } =
        await calcOethWithdrawAmount(fixture, withdrawAmount);
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      log("Before withdraw from strategy post rebalancing");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fixture: JSON.stringify(fixture),
      });

      // Now try to withdraw the WETH from the strategy
      const tx = await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, withdrawAmount);

      const receipt = await tx.wait();

      log("After withdraw from strategy post rebalancing");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fromBlock: receipt.blockNumber - 1,
        fixture: JSON.stringify(fixture),
      });
      // Check emitted events
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(weth.address, pool.address, withdrawAmount);
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withNamedArgs({ _asset: oeth.address, _pToken: pool.address });

      // Check the ETH and OETH balances in the aero pool
      const aeroBalancesAfter = await pool.getReserves();
      expect(aeroBalancesAfter[wethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[wethReserveIndex].sub(withdrawAmount),
        0.5 // 0.5% or 50 basis point
      );
      expect(aeroBalancesAfter[oethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[oethReserveIndex].sub(oethBurnAmount),
        0.5 // 0.5% or 50 basis point
      );

      // Check the OETH total supply decrease
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.5 // 0.5% or 50 basis point
      );

      // Check the WETH balance in the Vault
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(withdrawAmount)
      );
    });
    it("Vault should be able to withdraw all after rebalancing", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVaultSigner,
        weth,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      await rebalancePool(fixture);

      const {
        oethBurnAmount,
        ethWithdrawAmount,
        aeroBalances: aeroBalancesBefore,
        strategyOethBalanceBefore,
        strategyWethBalanceBefore,
      } = await calcWithdrawAllAmounts(fixture);

      const oethSupplyBefore = await oeth.totalSupply();

      log("Before withdraw all from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fixture: JSON.stringify(fixture),
      });

      // Now try to withdraw all the WETH from the strategy
      const tx = await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      const receipt = await tx.wait();

      log("After withdraw all from strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        output: false,
        fromBlock: receipt.blockNumber - 1,
        fixture: JSON.stringify(fixture),
      });

      // Check emitted events
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(weth.address, pool.address, ethWithdrawAmount);
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Withdrawal")
        .withArgs(oeth.address, pool.address, oethBurnAmount);

      // Check the ETH and OETH balances in the Aero sAMM Metapool
      const aeroBalancesAfter = await pool.getReserves();
      expect(aeroBalancesAfter[wethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[wethReserveIndex].sub(
          ethWithdrawAmount.sub(strategyWethBalanceBefore)
        ),
        0.05 // 0.05% or 5 basis point
      );
      expect(aeroBalancesAfter[oethReserveIndex]).to.approxEqualTolerance(
        aeroBalancesBefore[oethReserveIndex].sub(
          oethBurnAmount.sub(strategyOethBalanceBefore)
        ),
        0.05 // 0.05%
      );

      // Check the OETH total supply decrease
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.05 // 0.01% or 5 basis point
      );
    });
  });
});

/////////// HELPERS ////////////////

// Calculate the minted OETH amount for a deposit
async function calcOethMintAmount(fixture, wethDepositAmount) {
  const { weth, oeth, pool, oethReserveIndex, wethReserveIndex, aeroRouter } =
    fixture;

  // Get the WETH and WOETH balances in the Aero sAMM pool
  const aeroBalances = await pool.getReserves();
  // WETH balance - OETH balance
  const balanceDiff = aeroBalances[wethReserveIndex].sub(
    aeroBalances[oethReserveIndex]
  );

  let oethMintAmount = balanceDiff.lte(0)
    ? // If more OETH than ETH then mint same amount of WOETH as WETH
      wethDepositAmount
    : // If less OETH than WETH then mint the difference
      balanceDiff.add(wethDepositAmount);
  // Cap the minting to twice the WETH deposit amount
  const doubleWethDepositAmount = wethDepositAmount.mul(2);
  oethMintAmount = oethMintAmount.lte(doubleWethDepositAmount)
    ? oethMintAmount
    : doubleWethDepositAmount;

  let result = await aeroRouter.quoteAddLiquidity(
    weth.address,
    oeth.address,
    true,
    addresses.base.aeroFactoryAddress,
    wethDepositAmount,
    oethMintAmount
  );
  log(`OETH mint amount : ${formatUnits(result.amountB)}`);

  return {
    oethMintAmount: result.amountB,
    wethDeposited: result.amountA,
    aeroBalances,
  };
}

// Calculate the OETH and ETH amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const {
    aerodromeEthStrategy,
    aeroGauge,
    pool,
    oethReserveIndex,
    wethReserveIndex,
    aeroRouter,
    weth,
    oeth,
  } = fixture;

  // Get the ETH and OETH balances in the Aero sAMM Pool
  const aeroBalances = await pool.getReserves();
  const strategyLpAmount = await aeroGauge.balanceOf(
    aerodromeEthStrategy.address
  );

  const totalLpSupply = await pool.totalSupply();
  const strategyOethBalanceBefore = await oeth.balanceOf(
    aerodromeEthStrategy.address
  );
  const strategyWethBalanceBefore = await weth.balanceOf(
    aerodromeEthStrategy.address
  );

  // OETH to burn = OETH pool balance * strategy LP amount / total pool LP amount
  let oethBurnAmount = aeroBalances[oethReserveIndex]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  // Also include if there's any residue balance sitting in the contract
  oethBurnAmount = oethBurnAmount.add(strategyOethBalanceBefore);
  // ETH to withdraw = ETH pool balance * strategy LP amount / total pool LP amount
  let ethWithdrawAmount = aeroBalances[wethReserveIndex]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  // Also include if there's any residue balance sitting in the contract
  ethWithdrawAmount = ethWithdrawAmount.add(strategyWethBalanceBefore);

  log(`OETH burn amount    : ${formatUnits(oethBurnAmount)}`);
  log(`ETH withdraw amount : ${formatUnits(ethWithdrawAmount)}`);
  return {
    oethBurnAmount,
    ethWithdrawAmount,
    aeroBalances,
    strategyOethBalanceBefore,
    strategyWethBalanceBefore,
  };
}

// Calculate the amount of OETH burnt from a withdraw
async function calcOethWithdrawAmount(fixture, wethWithdrawAmount) {
  const { pool, oethReserveIndex, wethReserveIndex } = fixture;

  // Get the ETH and OETH balances in the AeroPool
  const aeroBalances = await pool.getReserves();

  // OETH to burn = WETH withdrawn * OETH pool balance / ETH pool balance
  const oethBurnAmount = wethWithdrawAmount
    .mul(aeroBalances[oethReserveIndex])
    .div(aeroBalances[wethReserveIndex]);

  log(`OETH burn amount : ${formatUnits(oethBurnAmount)}`);

  return { oethBurnAmount, aeroBalances };
}

function sqrt(value) {
  const ONE = ethers.BigNumber.from(1);
  const TWO = ethers.BigNumber.from(2);
  x = ethers.BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

// Calculate the LPToken price of the given sAMM pool
async function calcLPTokenPrice(fixture) {
  const { pool } = fixture;

  // Get the ETH and OETH balances in the Aero sAMM Pool
  const aeroBalances = await pool.getReserves();
  const x = aeroBalances._reserve0;
  const y = aeroBalances._reserve1;

  // invariant = (x^3 * y) + (y^3 * x)
  const invariant = x
    .pow(3)
    .mul(y)
    .div(ethers.constants.WeiPerEther.pow(3))
    .add(y.pow(3).mul(x).div(ethers.constants.WeiPerEther.pow(3)));
  // price = 2 * fourthroot of (invariant/2)
  const lpPrice =
    2 * sqrt(sqrt(invariant.div(ethers.constants.WeiPerEther).div(2)));

  log(`LP Price :  ${lpPrice} `);

  return lpPrice;
}

async function getParamsForPoolRebalance(
  fixture,
  desiredOethReservePct = 51,
  desiredWethReservePct = 49
) {
  const ONE_PERCENT = 100000;
  const {
    oeth,
    weth,
    aeroRouter,
    pool,
    josh,
    oethReserveIndex,
    wethReserveIndex,
  } = fixture;
  await oeth
    .connect(josh)
    .approve(aeroRouter.address, ethers.utils.parseUnits("1000"));

  await weth
    .connect(josh)
    .approve(aeroRouter.address, ethers.utils.parseUnits("1000"));

  log(
    "Stable liq ratio before",
    formatUnits(
      await aeroRouter.quoteStableLiquidityRatio(
        weth.address,
        oeth.address,
        addresses.base.aeroFactoryAddress
      )
    )
  );

  let reserves = await pool.getReserves();

  let oethReserve = reserves[oethReserveIndex];
  let wethReserve = reserves[wethReserveIndex];

  let oethPriceInWeth = await pool.getAmountOut(parseUnits("1"), oeth.address);
  let wethPriceInOeth = await pool.getAmountOut(parseUnits("1"), weth.address);

  // Calculate total value of the pool in WETH equivalent
  const totalValueInWeth = wethReserve.add(
    oethReserve.mul(oethPriceInWeth).div(ethers.utils.parseUnits("1", 18))
  );

  // Calculate current size of each token in the pool as a percentage of total value
  const currentWethSizeInPool = wethReserve
    .mul(ONE_PERCENT)
    .div(totalValueInWeth);

  const currentOethSizeInPool = oethReserve
    .mul(oethPriceInWeth)
    .mul(ONE_PERCENT)
    .div(totalValueInWeth)
    .div(ethers.utils.parseUnits("1", 18));

  log(`Current WETH size in pool: ${currentWethSizeInPool / 1000}%`);
  log(`Current OETH size in pool: ${currentOethSizeInPool / 1000}%`);

  // Desired percentages
  const desiredOethPercentage = BigNumber.from(desiredOethReservePct * 1000);
  const desiredWethPercentage = BigNumber.from(desiredWethReservePct * 1000);

  const desiredOethValueInWeth = totalValueInWeth
    .mul(desiredOethPercentage)
    .div(ONE_PERCENT);

  const desiredWethValueInWeth = totalValueInWeth
    .mul(desiredWethPercentage)
    .div(ONE_PERCENT);

  // Calculate current OETH and WETH values in WETH equivalent
  const currentOethValueInWeth = oethReserve
    .mul(oethPriceInWeth)
    .div(ethers.utils.parseUnits("1", 18));

  const currentWethValueInWeth = wethReserve;

  // Difference needed to achieve the balance in WETH equivalent
  const oethAdjustmentInWeth = desiredOethValueInWeth.sub(
    currentOethValueInWeth
  );
  const wethAdjustmentInWeth = desiredWethValueInWeth.sub(
    currentWethValueInWeth
  );

  // Convert OETH adjustment back to OETH units from WETH equivalent
  const oethAdjustment = oethAdjustmentInWeth
    .mul(ethers.utils.parseUnits("1", 18))
    .div(oethPriceInWeth);

  const wethAdjustment = wethAdjustmentInWeth
    .mul(ethers.utils.parseUnits("1", 18))
    .div(wethPriceInOeth);

  let amountIn, tokenIn, assetSymbol;
  if (oethAdjustment > 0) {
    amountIn = oethAdjustment;
    tokenIn = oeth.address;
    assetSymbol = "OETH";
  } else {
    amountIn = wethAdjustment;
    tokenIn = weth.address;
    assetSymbol = "WETH";
  }
  log(
    `Pool needs to be adjusted by: ${ethers.utils.formatUnits(
      amountIn,
      18
    )} ${assetSymbol}`
  );
  return { amountIn, tokenIn };
}

async function rebalancePool(fixture) {
  const { oeth, weth, josh, aeroRouter, aerodromeEthStrategy } = fixture;
  const oethToSwap = parseUnits("1000");
  await oeth.connect(josh).approve(aeroRouter.address, oethToSwap);

  // Perform swap to imbalance the pool
  await aeroRouter
    .connect(josh)
    .swapExactTokensForTokens(
      oethToSwap,
      0,
      [[oeth.address, weth.address, true, addresses.base.aeroFactoryAddress]],
      josh.address,
      parseInt(Date.now() / 1000) + 5 * 360
    );

  const { tokenIn, amountIn } = await getParamsForPoolRebalance(fixture);

  if (tokenIn == weth.address) {
    await weth.connect(josh).transfer(aerodromeEthStrategy.address, amountIn);
  }
  log("Before rebalancing pool");
  await run("aeroAmoStrat", {
    pool: "OETH",
    fixture: JSON.stringify(fixture),
    output: false,
  });
  // Rebalance pool
  tx = await aerodromeEthStrategy
    .connect(josh)
    .swapAndRebalancePool(amountIn, 0, tokenIn, josh.address);

  const receipt = await tx.wait();

  log("After rebalancing pool");
  await run("aeroAmoStrat", {
    pool: "OETH",
    fixture: JSON.stringify(fixture),
    output: false,
    fromBlock: receipt.blockNumber - 1,
  });
}
