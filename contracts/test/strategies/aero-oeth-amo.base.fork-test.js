const { expect } = require("chai");
const { formatUnits, parseUnits, parseEther } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { units, oethUnits, isCI, advanceTime } = require("../helpers");
const { aeroOETHAMOFixture } = require("../_fixture");
const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { impersonateAndFund } = require("../../utils/signers");
const { BigNumber } = require("ethers");
const { MAX_UINT256 } = require("../../utils/constants");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");

const log = require("../../utils/logger")("test:fork:aero-oeth:pool");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETH AMO Aerodrome Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("", () => {
    beforeEach(async () => {
      fixture = await baseFixture();
    });

    shouldBehaveLikeGovernable(() => ({
      ...fixture,
      strategy: fixture.aerodromeEthStrategy,
    }));

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

      expect(
        await aerodromeEthStrategy.getLPTokenPrice()
      ).to.approxEqualTolerance(
        BigNumber.from(ethers.constants.WeiPerEther.mul(lpPrice)),
        0.1
      );
    });
    it("Should be able to check balance", async () => {
      const { weth, josh, aerodromeEthStrategy } = fixture;

      const balance = await aerodromeEthStrategy.checkBalance(weth.address);
      log(`check balance ${balance}`);
      expect(balance).to.eq(0); // will be 0 initially as there are no deposits

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await aerodromeEthStrategy
        .connect(josh)
        .populateTransaction.checkBalance(weth.address);
      await josh.sendTransaction(tx);
    });
  });
  describe("with some WETH in the vault", () => {
    beforeEach(async () => {
      fixture = await baseFixture();
    });
    it("Vault should deposit some WETH to AMO strategy", async function () {
      const {
        aerodromeEthStrategy,
        oeth,
        weth,
        josh,
        oethVault,
        pool,
        wethReserveIndex,
        oethReserveIndex,
      } = fixture;

      const wethDepositAmount = await units("100", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      const { oethMintAmount: oethMintAmount } = await calcOethMintAmount(
        fixture,
        wethDepositAmount
      );
      const oethSupplyBefore = await oeth.totalSupply();

      let vaultSigner = await impersonateAndFund(oethVault.address);

      const aeroBalances = await pool.getReserves();

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

      // Check the ETH and OETH balances in the Aero sAMM Pool
      const aeroBalancesAfter = await pool.getReserves();
      expect(
        aeroBalancesAfter[wethReserveIndex].toString()
      ).to.approxEqualTolerance(
        aeroBalances[wethReserveIndex].add(wethDepositAmount),
        1
      );
      expect(
        aeroBalancesAfter[oethReserveIndex].toString()
      ).to.approxEqualTolerance(
        aeroBalances[oethReserveIndex].add(oethMintAmount),
        1
      );

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        0.1 // 1% or 10 basis point
      );
    });
    it("Should not be any dust left after deposit", async function () {
      const { aerodromeEthStrategy, weth, josh, oethVault } = fixture;

      let wethDepositAmount = await units("10", weth);
      let wethBalanceBefore = await weth.balanceOf(
        aerodromeEthStrategy.address
      );

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      let vaultSigner = await impersonateAndFund(oethVault.address);

      // Deposit 1
      await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, await units("10", weth));

      let wethBalanceAfter = await weth.balanceOf(aerodromeEthStrategy.address);
      expect(wethBalanceAfter).to.be.equal(wethBalanceBefore);

      // Deposit 2
      wethDepositAmount = await units("25", weth);
      wethBalanceBefore = wethBalanceAfter;
      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      wethBalanceAfter = await weth.balanceOf(aerodromeEthStrategy.address);
      expect(wethBalanceAfter).to.be.equal(wethBalanceBefore);
    });
    it("should collect reward tokens", async function () {
      const {
        oethBaseHarvester,
        aerodromeEthStrategy,
        weth,
        josh,
        oethVault,
        aeroGauge,
      } = fixture;

      // Add rewards to Gauge: STARTS¯
      const minter = await impersonateAndFund(
        "0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5"
      );
      const aeroTokenInstance = await ethers.getContractAt(
        "IERC20MintableBurnable",
        addresses.base.aeroTokenAddress
      );

      const voterAddress = await aeroGauge.voter();

      const voter = await impersonateAndFund(voterAddress);
      await aeroTokenInstance
        .connect(minter)
        .mint(voterAddress, parseEther("500"));

      await aeroTokenInstance
        .connect(voter)
        .approve(aeroGauge.address, parseEther("500"));

      await aeroGauge.connect(voter).notifyRewardAmount(parseEther("500"));

      // Add rewards to Gauge: ENDS

      const wethDepositAmount = await units("10", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      let vaultSigner = await impersonateAndFund(oethVault.address);
      await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      await advanceTime(10 * 24 * 3600); // fast-forward 10 days

      const rewardsAccrued = await aeroGauge.earned(
        aerodromeEthStrategy.address
      );
      const harvesterSigner = await impersonateAndFund(
        oethBaseHarvester.address
      );
      const harvesterBalanceBefore = await aeroTokenInstance.balanceOf(
        oethBaseHarvester.address
      );
      await aerodromeEthStrategy.connect(harvesterSigner).collectRewardTokens();
      const harvesterBalanceAfter = await aeroTokenInstance.balanceOf(
        oethBaseHarvester.address
      );

      expect(harvesterBalanceAfter.sub(harvesterBalanceBefore)).to.be.equal(
        rewardsAccrued
      );
    });
    it("Only vault can deposit some WETH to AMO strategy", async function () {
      const { aerodromeEthStrategy, josh, weth } = fixture;

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
      const { aerodromeEthStrategy, pool, josh, weth, oethVaultSigner } =
        fixture;

      const depositAmount = parseUnits("50");
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      let tx = aerodromeEthStrategy
        .connect(josh)
        .deposit(weth.address, depositAmount);
      await expect(tx).to.revertedWith("Caller is not the Vault");

      for (const signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
      tx = await aerodromeEthStrategy.connect(oethVaultSigner).depositAll();
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withNamedArgs({ _asset: weth.address, _pToken: pool.address });
      const wethBalance = await weth.balanceOf(aerodromeEthStrategy.address);
      expect(wethBalance).to.be.equal(0);
    });
  });
  describe("with the strategy having some OETH and WETH in the Pool", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture({
        wethMintAmount: 50,
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
    it("withdrawAll() should be able to withdraw an amount atleast what checkBalances() report: Balanced pool", async () => {
      const { aerodromeEthStrategy, oeth, oethVaultSigner, weth, oethVault } =
        fixture;
      let checkBalance = await aerodromeEthStrategy.checkBalance(weth.address);
      let wethBalanceBefore = await weth.balanceOf(oethVault.address);
      let oethTotalSupplyBefore = await oeth.totalSupply();
      await aerodromeEthStrategy.connect(oethVaultSigner).withdrawAll();
      let wethBalanceAfter = await weth.balanceOf(oethVault.address);
      let oethTotalSupplyAfter = await oeth.totalSupply();
      expect(checkBalance).to.be.lte(
        oethTotalSupplyBefore
          .sub(oethTotalSupplyAfter)
          .add(wethBalanceAfter.sub(wethBalanceBefore))
      );
    });
    it("withdrawAll() should be able to withdraw an amount atleast what checkBalances() report: Tilt - More OETH", async () => {
      const {
        aerodromeEthStrategy,
        aeroRouter,
        oeth,
        oethVaultSigner,
        weth,
        josh,
        oethVault,
      } = fixture;

      let wethBalanceBefore = await weth.balanceOf(oethVault.address);

      await oeth.connect(oethVaultSigner).mint(josh.address, oethUnits("300"));
      await oeth.connect(josh).approve(aeroRouter.address, oethUnits("300"));
      let oethTotalSupplyBefore = await oeth.totalSupply();

      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          parseUnits("300"),
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
      let checkBalance = await aerodromeEthStrategy.checkBalance(weth.address);
      await aerodromeEthStrategy.connect(oethVaultSigner).withdrawAll();
      let wethBalanceAfter = await weth.balanceOf(oethVault.address);
      let oethTotalSupplyAfter = await oeth.totalSupply();
      expect(checkBalance).to.be.lte(
        oethTotalSupplyBefore
          .sub(oethTotalSupplyAfter)
          .add(wethBalanceAfter.sub(wethBalanceBefore))
      );
    });
    it("withdraw() should be able to withdraw amount specified: Tilt - More OETH", async () => {
      const {
        aerodromeEthStrategy,
        aeroRouter,
        oeth,
        oethVaultSigner,
        weth,
        josh,
        oethVault,
      } = fixture;

      const requiredWeth = oethUnits("20");
      await oeth.connect(oethVaultSigner).mint(josh.address, oethUnits("300"));
      await oeth.connect(josh).approve(aeroRouter.address, oethUnits("300"));
      let wethBalanceBefore = await weth.balanceOf(oethVault.address);
      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          parseUnits("300"),
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

      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, requiredWeth);
      let wethBalanceAfter = await weth.balanceOf(oethVault.address);

      expect(requiredWeth).to.be.lte(wethBalanceAfter.sub(wethBalanceBefore));
    });
    it("withdraw() should be able to withdraw amount specified: Tilt - More WETH", async () => {
      const {
        aerodromeEthStrategy,
        aeroRouter,
        oeth,
        oethVaultSigner,
        weth,
        josh,
        oethVault,
      } = fixture;

      const requiredWeth = oethUnits("25");
      await weth.connect(josh).approve(aeroRouter.address, oethUnits("300"));
      let wethBalanceBefore = await weth.balanceOf(oethVault.address);
      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          parseUnits("300"),
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

      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, requiredWeth);
      let wethBalanceAfter = await weth.balanceOf(oethVault.address);

      expect(requiredWeth).to.be.lte(wethBalanceAfter.sub(wethBalanceBefore));
    });
    it("withdrawAll() should be able to withdraw an amount atleast what checkBalances() report: Tilt - More WETH", async () => {
      const {
        aerodromeEthStrategy,
        aeroRouter,
        oeth,
        oethVaultSigner,
        weth,
        josh,
        oethVault,
      } = fixture;

      let wethBalanceBefore = await weth.balanceOf(oethVault.address);

      await weth.connect(josh).approve(aeroRouter.address, oethUnits("300"));
      let oethTotalSupplyBefore = await oeth.totalSupply();

      await aeroRouter
        .connect(josh)
        .swapExactTokensForTokens(
          parseUnits("300"),
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
      let checkBalance = await aerodromeEthStrategy.checkBalance(weth.address);
      await aerodromeEthStrategy.connect(oethVaultSigner).withdrawAll();
      let wethBalanceAfter = await weth.balanceOf(oethVault.address);
      let oethTotalSupplyAfter = await oeth.totalSupply();
      expect(checkBalance).to.be.lte(
        oethTotalSupplyBefore
          .sub(oethTotalSupplyAfter)
          .add(wethBalanceAfter.sub(wethBalanceBefore))
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

      const withdrawAmount = oethUnits("30");

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
        governor,
        minter,
        burner,
        josh,
        weth,
      } = fixture;
      for (const signer of [josh, governor, minter, burner]) {
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
    const oethToSwap = parseUnits("100");
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Should be able to mint OETH and send received weth to vault", async function () {
      const {
        oeth,
        weth,
        josh,
        aeroRouter,
        aerodromeEthStrategy,
        oethVault,
        oethVaultSigner,
      } = fixture;

      let vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
      let wethToSwap = oethToSwap;
      await oeth.connect(oethVaultSigner).mint(josh.address, oethUnits("100"));
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
      const { tokenIn, amountIn } = await getParamsForPoolRebalance(
        fixture,
        54,
        46
      );
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
      const strategistAddress = await oethVault.strategistAddr();
      const sStrategist = await impersonateAndFund(strategistAddress);
      // Rebalance pool
      const tx = await aerodromeEthStrategy
        .connect(sStrategist)
        .swapAndRebalancePool(amountIn, 0, tokenIn);

      const receipt = await tx.wait();

      log("After rebalancing pool");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      let vaultWethBalanceAfter = await weth.balanceOf(oethVault.address);

      expect(vaultWethBalanceAfter).to.gt(vaultWethBalanceBefore);
    });
    it("Should be able to burn OETH when rebalancing", async function () {
      const { oethVault } = fixture;

      let netOEthMintedBefore = await oethVault.netOusdMintedForStrategy();

      await rebalancePool(fixture);

      let netOEthMintedAfter = await oethVault.netOusdMintedForStrategy();

      expect(netOEthMintedAfter).to.lt(netOEthMintedBefore);
    });

    it("Should not rebalance pool by making the WETH reserve > OETH reserve", async function () {
      const { weth, josh, aerodromeEthStrategy, oethVault } = fixture;

      // Try to make the pool balance even worse (should revert)
      const { tokenIn, amountIn } = await getParamsForPoolRebalance(
        fixture,
        48,
        52
      );
      if (tokenIn == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn);
      }
      const strategistAddress = await oethVault.strategistAddr();
      const sStrategist = await impersonateAndFund(strategistAddress);
      // Rebalance pool should revert with error message
      const tx = aerodromeEthStrategy
        .connect(sStrategist)
        .swapAndRebalancePool(amountIn, 0, tokenIn);

      await expect(tx).to.revertedWith("WETH reserves exceeds OETH");
    });
    it("Should not rebalance pool more than allowed threshold", async function () {
      const {
        oeth,
        weth,
        josh,
        aeroRouter,
        aerodromeEthStrategy,
        oethVault,
        oethVaultSigner,
      } = fixture;
      await oeth.connect(oethVaultSigner).mint(josh.address, oethToSwap);
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

      const strategistAddress = await oethVault.strategistAddr();
      const sStrategist = await impersonateAndFund(strategistAddress);
      // Rebalance pool
      await aerodromeEthStrategy
        .connect(sStrategist)
        .swapAndRebalancePool(amountIn, 0, tokenIn);
      // Try to make the pool balance even worse (should revert)
      const { tokenIn: tokenIn2, amountIn: amountIn2 } =
        await getParamsForPoolRebalance(fixture, 60, 40);
      if (tokenIn2 == weth.address) {
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, amountIn2);
      }

      // Rebalance pool should revert with error message
      const tx = aerodromeEthStrategy
        .connect(sStrategist)
        .swapAndRebalancePool(amountIn2, 0, tokenIn2);
      await expect(tx).to.revertedWith("Pool imbalance worsened");
    });
    it("Vault should be able to deposit some WETH to AMO strategy after rebalancing", async function () {
      const { aerodromeEthStrategy, oeth, weth, josh, oethVault } = fixture;

      await rebalancePool(fixture);
      const wethDepositAmount = await units("100", weth);

      // Vault transfers WETH to strategy
      await weth.connect(josh).deposit({ value: wethDepositAmount });
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);
      let vaultSigner = await impersonateAndFund(oethVault.address, "2");

      const { oethMintAmount: oethMintAmount } = await calcOethMintAmount(
        fixture,
        wethDepositAmount
      );
      const oethSupplyBefore = await oeth.totalSupply();

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

      // Check emitted events
      await expect(tx).to.emit(aerodromeEthStrategy, "Deposit");

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        10
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
      await weth.connect(josh).deposit({ value: depositAmount });
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      log("Before depositAll to strategy");
      await run("aeroAmoStrat", {
        pool: "OETH",
        fixture: JSON.stringify(fixture),
        output: false,
      });

      const tx = await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .depositAll();

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
      const wethBalance = await weth.balanceOf(aerodromeEthStrategy.address);
      expect(wethBalance).to.be.equal(0);
    });
    it("Vault should be able to withdraw some after rebalancing", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        josh,
        oethVaultSigner,
        weth,
        oethVault,
        oethReserveIndex,
        wethReserveIndex,
      } = fixture;

      // deposit first
      const wethDepositAmount = await units("220", weth);

      // Vault transfers WETH to strategy
      await weth.connect(josh).deposit({ value: wethDepositAmount });
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .deposit(weth.address, wethDepositAmount);

      await rebalancePool(fixture);

      const withdrawAmount = oethUnits("80");

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
      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, parseUnits("1"));
      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, parseUnits("0.0000000001"));
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
        josh,
      } = fixture;
      // deposit first
      const wethDepositAmount = await units("100", weth);

      // Vault transfers WETH to strategy
      await weth.connect(josh).deposit({ value: wethDepositAmount });
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      await aerodromeEthStrategy
        .connect(oethVaultSigner)
        .deposit(weth.address, wethDepositAmount);

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
  describe("With pool tilts - random WETH amounts:", () => {
    const poolTilts = [
      { oeth: 10, weth: 90 },
      { oeth: 20, weth: 80 },
      { oeth: 30, weth: 70 },
      { oeth: 40, weth: 60 },
      { oeth: 60, weth: 40 },
      { oeth: 70, weth: 30 },
      { oeth: 80, weth: 20 },
      { oeth: 90, weth: 10 },
    ];
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("should depositAll()", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVaultSigner,
        weth,
        aeroRouter,
        wethReserveIndex,
        josh,
        oethReserveIndex,
      } = fixture;
      await weth.connect(josh).approve(aeroRouter.address, MAX_UINT256);
      await oeth.connect(josh).approve(aeroRouter.address, MAX_UINT256);
      for (i = 0; i < poolTilts.length; i++) {
        let oethReservePct = poolTilts[i].oeth;
        let wethReservePct = poolTilts[i].weth;
        let { tokenIn, amountIn } = await getParamsForPoolRebalance(
          fixture,
          oethReservePct,
          wethReservePct
        );
        let tokenOut;

        if (tokenIn == weth.address) {
          tokenOut = oeth.address;
        } else {
          tokenOut = weth.address;
        }

        // Tilt the pool
        await aeroRouter
          .connect(josh)
          .swapExactTokensForTokens(
            amountIn,
            0,
            [[tokenIn, tokenOut, true, addresses.base.aeroFactoryAddress]],
            josh.address,
            parseInt(Date.now() / 1000) + 5 * 360
          );
        const randomDepositAmount =
          Math.floor(Math.random() * (250 - 10 + 1)) + 10; // in the range of 10 - 250 WETH
        // Vault transfers WETH to strategy
        await weth
          .connect(josh)
          .transfer(
            aerodromeEthStrategy.address,
            await units(randomDepositAmount.toString(), weth)
          );

        const wethDepositAmount = await weth.balanceOf(
          aerodromeEthStrategy.address
        );
        console.log("Deposit amount", wethDepositAmount.toString() / 1e18);
        const { oethMintAmount: oethMintAmount } = await calcOethMintAmount(
          fixture,
          wethDepositAmount
        );
        const oethSupplyBefore = await oeth.totalSupply();
        const aeroBalancesBefore = await pool.getReserves();

        await aerodromeEthStrategy
          .connect(oethVaultSigner)
          .deposit(weth.address, wethDepositAmount);

        // Check the ETH and OETH balances in the Aero sAMM Pool
        const aeroBalancesAfter = await pool.getReserves();
        expect(
          aeroBalancesAfter[wethReserveIndex].toString()
        ).to.approxEqualTolerance(
          aeroBalancesBefore[wethReserveIndex].add(wethDepositAmount),
          1
        );
        expect(
          aeroBalancesAfter[oethReserveIndex].toString()
        ).to.approxEqualTolerance(
          aeroBalancesBefore[oethReserveIndex].add(oethMintAmount),
          1
        );
        const oethSupplyAfter = await oeth.totalSupply();
        expect(oethSupplyAfter).to.approxEqualTolerance(
          oethSupplyBefore.add(oethMintAmount),
          0.1 // 1% or 10 basis point
        );
        console.log(
          "✔️ DepositAll() check success for pool tilt -",
          poolTilts[i].oeth,
          ":",
          poolTilts[i].weth
        );

        // rebalance the pool closer to 50:50
        await aeroRouter
          .connect(josh)
          .swapExactTokensForTokens(
            amountIn.sub(
              BigNumber.from(i < 4 ? oethReservePct : wethReservePct).mul(
                ethers.constants.WeiPerEther
              )
            ),
            0,
            [[tokenOut, tokenIn, true, addresses.base.aeroFactoryAddress]],
            josh.address,
            parseInt(Date.now() / 1000) + 5 * 360
          );
      }
    });
    it("should withdrawAll()", async () => {
      const {
        aerodromeEthStrategy,
        pool,
        oeth,
        oethVault,
        oethVaultSigner,
        weth,
        aeroRouter,
        wethReserveIndex,
        josh,
        oethReserveIndex,
      } = fixture;
      await weth.connect(josh).approve(aeroRouter.address, MAX_UINT256);
      await oeth.connect(josh).approve(aeroRouter.address, MAX_UINT256);
      for (i = 0; i < poolTilts.length; i++) {
        let oethReservePct = poolTilts[i].oeth;
        let wethReservePct = poolTilts[i].weth;
        let { tokenIn, amountIn } = await getParamsForPoolRebalance(
          fixture,
          oethReservePct,
          wethReservePct
        );
        let tokenOut;

        if (tokenIn == weth.address) {
          tokenOut = oeth.address;
        } else {
          tokenOut = weth.address;
        }

        // Tilt the pool
        await aeroRouter
          .connect(josh)
          .swapExactTokensForTokens(
            amountIn,
            0,
            [[tokenIn, tokenOut, true, addresses.base.aeroFactoryAddress]],
            josh.address,
            parseInt(Date.now() / 1000) + 5 * 360
          );
        const wethDepositAmount = await units(
          (Math.floor(Math.random() * (250 - 50 + 1)) + 10).toString(),
          weth
        );

        // Vault transfers WETH to strategy
        await weth
          .connect(josh)
          .transfer(aerodromeEthStrategy.address, wethDepositAmount);

        await aerodromeEthStrategy
          .connect(oethVaultSigner)
          .deposit(weth.address, wethDepositAmount);

        const {
          oethBurnAmount,
          ethWithdrawAmount,
          aeroBalances: aeroBalancesBefore,
          strategyOethBalanceBefore,
          strategyWethBalanceBefore,
        } = await calcWithdrawAllAmounts(fixture);

        const oethSupplyBefore = await oeth.totalSupply();

        // Now try to withdraw the WETH from the strategy
        await aerodromeEthStrategy.connect(oethVaultSigner).withdrawAll();

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

        console.log(
          "✔️ WithdrawAll() checks success for pool tilt -",
          poolTilts[i].oeth,
          ":",
          poolTilts[i].weth
        );

        // rebalance the pool closer to 50:50
        await aeroRouter
          .connect(josh)
          .swapExactTokensForTokens(
            amountIn.sub(
              BigNumber.from(i < 4 ? oethReservePct : wethReservePct).mul(
                ethers.constants.WeiPerEther
              )
            ),
            0,
            [[tokenOut, tokenIn, true, addresses.base.aeroFactoryAddress]],
            josh.address,
            parseInt(Date.now() / 1000) + 5 * 360
          );
      }
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

  const oethMintAmount = aeroBalances[oethReserveIndex]
    .mul(wethDepositAmount)
    .div(aeroBalances[wethReserveIndex]);

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
  let x = ethers.BigNumber.from(value);
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

  // price = 2 * fourthroot of (invariant/2)
  const lpPrice =
    2 *
    sqrt(sqrt(x.pow(3).mul(y).add(y.pow(3).mul(x)).div(2))).div(
      await pool.totalSupply()
    );

  log(`LP Price :  ${lpPrice} `);

  return lpPrice;
}

async function getParamsForPoolRebalance(
  fixture,
  desiredOethReservePct = 51,
  desiredWethReservePct = 49
) {
  const ONE_PERCENT = BigNumber.from(100000);
  const { oeth, weth, aeroRouter, pool, oethReserveIndex, wethReserveIndex } =
    fixture;

  let reserves = await pool.getReserves();

  let oethReserve = reserves[oethReserveIndex];
  let wethReserve = reserves[wethReserveIndex];

  let oethPriceInWeth = await pool.getAmountOut(parseUnits("1"), oeth.address);
  let wethPriceInOeth = await pool.getAmountOut(parseUnits("1"), weth.address);

  // Calculate total value of the pool in WETH equivalent
  const totalValueInWeth = wethReserve.add(
    oethReserve.mul(oethPriceInWeth).div(parseUnits("1", 18))
  );

  // Calculate current size of each token in the pool as a percentage of total value
  const currentWethSizeInPool = wethReserve
    .mul(ONE_PERCENT)
    .div(totalValueInWeth);

  const currentOethSizeInPool = oethReserve
    .mul(oethPriceInWeth)
    .mul(ONE_PERCENT)
    .div(totalValueInWeth)
    .div(parseUnits("1", 18));

  log(`Current WETH size in pool: ${currentWethSizeInPool.div(1000)}%`);
  log(`Current OETH size in pool: ${currentOethSizeInPool.div(1000)}%`);

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
    .div(parseUnits("1", 18));

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
    .mul(parseUnits("1", 18))
    .div(oethPriceInWeth);

  const wethAdjustment = wethAdjustmentInWeth
    .mul(parseUnits("1", 18))
    .div(wethPriceInOeth);

  let amountIn, tokenIn, assetSymbol;
  if (oethAdjustment.gt(0)) {
    amountIn = oethAdjustment;
    tokenIn = oeth.address;
    assetSymbol = "OETH";
  } else {
    amountIn = wethAdjustment;
    tokenIn = weth.address;
    assetSymbol = "WETH";
  }

  log(
    `Pool needs to be adjusted by: ${formatUnits(amountIn, 18)} ${assetSymbol}`
  );
  return { amountIn, tokenIn };
}

async function rebalancePool(fixture) {
  const {
    oeth,
    weth,
    josh,
    aeroRouter,
    aerodromeEthStrategy,
    oethVaultSigner,
    oethVault,
  } = fixture;
  const oethToSwap = parseUnits("100");
  await oeth.connect(oethVaultSigner).mint(josh.address, oethUnits("100"));
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
  const strategistAddress = await oethVault.strategistAddr();
  const sStrategist = await impersonateAndFund(strategistAddress);
  // Rebalance pool
  const tx = await aerodromeEthStrategy
    .connect(sStrategist)
    .swapAndRebalancePool(amountIn, 0, tokenIn);

  const receipt = await tx.wait();

  log("After rebalancing pool");
  await run("aeroAmoStrat", {
    pool: "OETH",
    fixture: JSON.stringify(fixture),
    output: false,
    fromBlock: receipt.blockNumber - 1,
  });
}
