const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { oethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  createFixture,
  defaultFixtureSetup,
  convexOETHMetaVaultFixture,
} = require("../_fixture");
const { logCurvePool } = require("../../utils/curve");

const log = require("../../utils/logger")("test:fork:oeth:metapool");

const defaultFixturePromise = createFixture(convexOETHMetaVaultFixture);
const mintedFixturePromise = createFixture(convexOETHMetaVaultFixture, {
  wethMintAmount: 5000,
});

forkOnlyDescribe("ForkTest: OETH AMO Curve Metapool Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(0);

  let fixture;
  after(async () => {
    // This is needed to revert fixtures
    // The other tests as of now don't use proper fixtures
    // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
    const f = defaultFixtureSetup();
    await f();
  });

  describe("with mainnet data", () => {
    beforeEach(async () => {
      fixture = await defaultFixturePromise();
    });
    it("Should have constants and immutables set", async () => {
      const { convexEthMetaStrategy } = fixture;

      expect(await convexEthMetaStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );
      expect(await convexEthMetaStrategy.ETH_ADDRESS()).to.equal(addresses.ETH);

      expect(await convexEthMetaStrategy.cvxDepositorAddress()).to.equal(
        addresses.mainnet.CVXBooster
      );
      expect(await convexEthMetaStrategy.cvxRewardStaker()).to.equal(
        addresses.mainnet.CVXETHRewardsPool
      );
      expect(await convexEthMetaStrategy.cvxDepositorPTokenId()).to.equal(
        oethPoolLpPID
      );
      expect(await convexEthMetaStrategy.curvePool()).to.equal(
        addresses.mainnet.CurveOETHMetaPool
      );
      expect(await convexEthMetaStrategy.lpToken()).to.equal(
        addresses.mainnet.CurveOETHMetaPool
      );
      expect(await convexEthMetaStrategy.oeth()).to.equal(
        addresses.mainnet.OETHProxy
      );
      expect(await convexEthMetaStrategy.weth()).to.equal(
        addresses.mainnet.WETH
      );
    });
    it("Should be able to check balance", async () => {
      const { weth, josh, convexEthMetaStrategy } = fixture;

      const balance = await convexEthMetaStrategy.checkBalance(weth.address);
      log(`check balance ${balance}`);
      expect(balance).gt(0);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await convexEthMetaStrategy
        .connect(josh)
        .populateTransaction.checkBalance(weth.address);
      await josh.sendTransaction(tx);
    });
    it("Should be able to harvest the rewards", async function () {
      const {
        josh,
        weth,
        oethHarvester,
        oethDripper,
        oethVault,
        convexEthMetaStrategy,
        crv,
      } = fixture;

      // send some CRV to the strategy to partly simulate reward harvesting
      await crv
        .connect(josh)
        .transfer(convexEthMetaStrategy.address, oethUnits("1000"));

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // prettier-ignore
      await oethHarvester
        .connect(josh)["harvestAndSwap(address)"](convexEthMetaStrategy.address);

      const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
        wethBefore
      );
      await oethVault.connect(josh).rebase();

      await expect(wethDiff).to.be.gte(oethUnits("0.3"));
    });
  });

  describe("with some WETH in the vault", () => {
    beforeEach(async () => {
      fixture = await mintedFixturePromise();
    });
    it("Strategist should deposit to Metapool", async function () {
      const {
        convexEthMetaStrategy,
        oeth,
        oethMetaPool,
        oethVault,
        strategist,
        weth,
      } = fixture;

      const wethDepositAmount = await units("5000", weth);

      const { oethMintAmount, curveBalances: curveBalancesBefore } =
        await calcOethMintAmount(fixture, wethDepositAmount);
      const oethSupplyBefore = await oeth.totalSupply();

      log("Before deposit to strategy");
      await logCurvePool(oethMetaPool, "ETH ", "OETH");

      await oethVault
        .connect(strategist)
        .depositToStrategy(
          convexEthMetaStrategy.address,
          [weth.address],
          [wethDepositAmount]
        );

      log("After deposit to strategy");
      await logCurvePool(oethMetaPool, "ETH ", "OETH");

      // Check the ETH and OETH balances in the Curve Metapool
      const curveBalancesAfter = await oethMetaPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].add(wethDepositAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].add(oethMintAmount),
        0.01 // 0.01% or 1 basis point
      );

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        0.01 // 0.01% or 1 basis point
      );
    });

    describe("withdraw", async function () {
      beforeEach(async () => {
        const { convexEthMetaStrategy, oethVault, weth, strategist } = fixture;

        const withdrawAmount = oethUnits("100");

        await oethVault
          .connect(strategist)
          .depositToStrategy(
            convexEthMetaStrategy.address,
            [weth.address],
            [withdrawAmount]
          );
      });
      it("Should be able to withdraw all", async () => {
        const { convexEthMetaStrategy, oethMetaPool, oeth, vaultSigner } =
          fixture;

        const {
          oethBurnAmount,
          ethWithdrawAmount,
          curveBalances: curveBalancesBefore,
        } = await calcWithdrawAllAmounts(fixture);
        const oethSupplyBefore = await oeth.totalSupply();

        log("Before withdraw all from strategy");
        await logCurvePool(oethMetaPool, "ETH ", "OETH");

        // Now try to withdraw all the WETH from the strategy
        await convexEthMetaStrategy.connect(vaultSigner).withdrawAll();

        log("After withdraw all from strategy");
        await logCurvePool(oethMetaPool, "ETH ", "OETH");

        // Check the ETH and OETH balances in the Curve Metapool
        const curveBalancesAfter = await oethMetaPool.get_balances();
        expect(curveBalancesAfter[0]).to.approxEqualTolerance(
          curveBalancesBefore[0].sub(ethWithdrawAmount),
          0.01 // 0.01% or 1 basis point
        );
        expect(curveBalancesAfter[1]).to.approxEqualTolerance(
          curveBalancesBefore[1].sub(oethBurnAmount),
          0.01 // 0.01%
        );

        // Check the OETH total supply decrease
        const oethSupplyAfter = await oeth.totalSupply();
        expect(oethSupplyAfter).to.approxEqualTolerance(
          oethSupplyBefore.sub(oethBurnAmount),
          0.01 // 0.01% or 1 basis point
        );
      });

      it("Should be able to withdraw some", async () => {
        const {
          convexEthMetaStrategy,
          oeth,
          oethMetaPool,
          oethVault,
          vaultSigner,
          weth,
        } = fixture;

        const withdrawAmount = oethUnits("1000");

        const { oethBurnAmount, curveBalances: curveBalancesBefore } =
          await calcOethBurnAmount(fixture, withdrawAmount);
        const oethSupplyBefore = await oeth.totalSupply();

        log("Before withdraw from strategy");
        await logCurvePool(oethMetaPool, "ETH ", "OETH");

        // Now try to withdraw the WETH from the strategy
        await convexEthMetaStrategy
          .connect(vaultSigner)
          .withdraw(oethVault.address, weth.address, withdrawAmount);

        log("After withdraw from strategy");
        await logCurvePool(oethMetaPool, "ETH ", "OETH");

        // Check the ETH and OETH balances in the Curve Metapool
        const curveBalancesAfter = await oethMetaPool.get_balances();
        expect(curveBalancesAfter[0]).to.approxEqualTolerance(
          curveBalancesBefore[0].sub(withdrawAmount),
          0.01 // 0.01% or 1 basis point
        );
        expect(curveBalancesAfter[1]).to.approxEqualTolerance(
          curveBalancesBefore[1].sub(oethBurnAmount),
          0.01 // 0.01%
        );

        // Check the OETH total supply decrease
        const oethSupplyAfter = await oeth.totalSupply();
        expect(oethSupplyAfter).to.approxEqualTolerance(
          oethSupplyBefore.sub(oethBurnAmount),
          0.01 // 0.01% or 1 basis point
        );
      });
    });
  });
});

// Calculate the OETH mint amount
async function calcOethMintAmount(fixture, wethDepositAmount) {
  const { oethMetaPool } = fixture;

  // Get the ETH and OETH balances in the Curve Metapool
  const curveBalances = await oethMetaPool.get_balances();
  // ETH balance - OETH balance
  const balanceDiff = curveBalances[0].sub(curveBalances[1]);

  let oethMintAmount = balanceDiff.lte(0)
    ? // If more OETH than ETH then mint same amount of OETH as ETH
      wethDepositAmount
    : // If less OETH than ETH then mint the difference
      balanceDiff.add(wethDepositAmount);
  // Cap the minting to twice the ETH deposit amount
  const doubleWethDepositAmount = wethDepositAmount.mul(2);
  oethMintAmount = oethMintAmount.lte(doubleWethDepositAmount)
    ? oethMintAmount
    : doubleWethDepositAmount;
  log(`OETH mint amount : ${formatUnits(oethMintAmount)}`);

  return { oethMintAmount, curveBalances };
}

// Calculate the OETH mint amount
async function calcOethBurnAmount(fixture, wethWithdrawAmount) {
  const { oethMetaPool } = fixture;

  // Get the ETH and OETH balances in the Curve Metapool
  const curveBalances = await oethMetaPool.get_balances();

  // OETH to burn = WETH withdrawn * OETH pool balance / ETH pool balance
  const oethBurnAmount = wethWithdrawAmount
    .mul(curveBalances[1])
    .div(curveBalances[0]);

  log(`OETH burn amount : ${formatUnits(oethBurnAmount)}`);

  return { oethBurnAmount, curveBalances };
}

// Calculate the OETH mint amount
async function calcWithdrawAllAmounts(fixture) {
  const { convexEthMetaStrategy, cvxRewardPool, oethMetaPool } = fixture;

  // Get the ETH and OETH balances in the Curve Metapool
  const curveBalances = await oethMetaPool.get_balances();
  const strategyLpAmount = await cvxRewardPool.balanceOf(
    convexEthMetaStrategy.address
  );
  const totalLpSupply = await oethMetaPool.totalSupply();

  // OETH to burn = OETH pool balance * strategy LP amount / total pool LP amount
  const oethBurnAmount = curveBalances[1]
    .mul(strategyLpAmount)
    .div(totalLpSupply);
  // ETH to withdraw = ETH pool balance * strategy LP amount / total pool LP amount
  const ethWithdrawAmount = curveBalances[0]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  log(`OETH burn amount    : ${formatUnits(oethBurnAmount)}`);
  log(`ETH withdraw amount : ${formatUnits(ethWithdrawAmount)}`);

  return { oethBurnAmount, ethWithdrawAmount, curveBalances };
}
