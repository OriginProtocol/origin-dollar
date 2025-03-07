const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader } = require("../../_fixture");
const { swapXAMOFixture } = require("../../_fixture-sonic");
const { isCI } = require("../../helpers");
const addresses = require("../../../utils/addresses");

const log = require("../../../utils/logger")("test:fork:sonic:swapx:amo");

describe("Sonic ForkTest: SwapX AMO Strategy", function () {
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { swapXAMOStrategy } = fixture;

      expect(await swapXAMOStrategy.SOLVENCY_THRESHOLD()).to.equal(
        parseUnits("0.998", 18)
      );
      expect(await swapXAMOStrategy.ws()).to.equal(addresses.sonic.wS);
      expect(await swapXAMOStrategy.os()).to.equal(addresses.sonic.OSonicProxy);
      expect(await swapXAMOStrategy.pool()).to.equal(
        addresses.sonic.SwapXWSOS.pool
      );
      expect(await swapXAMOStrategy.gauge()).to.equal(
        addresses.sonic.SwapXWSOS.gauge
      );
      expect(await swapXAMOStrategy.governor()).to.equal(
        addresses.sonic.timelock
      );
      expect(await swapXAMOStrategy.supportsAsset(addresses.sonic.wS)).to.true;
    });
    it("Should be able to check balance", async () => {
      const { wS, nick, swapXAMOStrategy } = fixture;

      const balance = await swapXAMOStrategy.checkBalance(wS.address);
      log(`check balance ${balance}`);
      expect(balance).gte(0);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await swapXAMOStrategy
        .connect(nick)
        .populateTransaction.checkBalance(wS.address);
      await nick.sendTransaction(tx);
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        timelock,
        strategist,
        nick,
        oSonicVaultSigner,
        swapXAMOStrategy,
        wS,
        oSonic,
        swapXPool,
      } = fixture;

      expect(await swapXAMOStrategy.connect(timelock).isGovernor()).to.equal(
        true
      );

      // Timelock can approve all tokens
      const tx = await swapXAMOStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(wS, "Approval");
      await expect(tx).to.emit(oSonic, "Approval");
      await expect(tx).to.emit(swapXPool, "Approval");

      for (const signer of [strategist, nick, oSonicVaultSigner]) {
        const tx = swapXAMOStrategy.connect(signer).safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with wS in the vault", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: false,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("2000"));
    });
    it("Only vault can deposit wS to AMO strategy", async function () {
      const {
        swapXAMOStrategy,
        oSonicVaultSigner,
        strategist,
        timelock,
        nick,
        wS,
      } = fixture;

      const depositAmount = parseUnits("50");
      await wS
        .connect(oSonicVaultSigner)
        .transfer(swapXAMOStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, nick]) {
        const tx = swapXAMOStrategy
          .connect(signer)
          .deposit(wS.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all wS to AMO strategy", async function () {
      const {
        swapXAMOStrategy,
        swapXPool,
        oSonicVaultSigner,
        strategist,
        timelock,
        nick,
        wS,
      } = fixture;

      const depositAmount = parseUnits("50");
      await wS
        .connect(oSonicVaultSigner)
        .transfer(swapXAMOStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, nick]) {
        const tx = swapXAMOStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await swapXAMOStrategy.connect(oSonicVaultSigner).depositAll();
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Deposit")
        .withNamedArgs({ _asset: wS.address, _pToken: swapXPool.address });
    });
  });

  describe("with the strategy having OS and wS in a balanced pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: true,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("5000"));
    });
    it("Vault should be able to withdraw all", async () => {
      await assertWithdrawAll();
    });
    it("Vault should be able to partially withdraw", async () => {
      await assertWithdrawPartial(parseUnits("1000"));
    });
    it("Only vault can withdraw wS from AMO strategy", async function () {
      const { swapXAMOStrategy, oSonicVault, strategist, timelock, nick, wS } =
        fixture;

      for (const signer of [strategist, timelock, nick]) {
        const tx = swapXAMOStrategy
          .connect(signer)
          .withdraw(oSonicVault.address, wS.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all WETH from AMO strategy", async function () {
      const { swapXAMOStrategy, strategist, timelock, nick } = fixture;

      for (const signer of [strategist, nick]) {
        const tx = swapXAMOStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = swapXAMOStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(swapXAMOStrategy, "Withdrawal");
    });
  });

  describe("with a lot more OS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: true,
      balancePool: true,
      poolAddOSAmount: 60000,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("5000"));
    });
    it("Vault should be able to withdraw all", async () => {
      await assertWithdrawAll();
    });
    it("Vault should be able to partially withdraw", async () => {
      await assertWithdrawPartial(parseUnits("4000"));
    });
    it("Strategist should swap a little assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3"));
    });
    it("Strategist should swap a lot of assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3000"));
    });
    it("Strategist should swap most of the wS owned by the strategy", async () => {
      // TODO calculate how much wS should be swapped to get the pool balanced
      await assertSwapAssetsToPool(parseUnits("4400"));
    });
    it("Strategist should fail to swap all wS owned by the strategy", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapAssetsToPool(parseUnits("5000"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to add more wS than owned by the strategy", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapAssetsToPool(parseUnits("20000"));

      await expect(tx).to.be.revertedWith("Not enough LP tokens in gauge");
    });
    it("Strategist should fail to add more OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping OS into the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapOTokensToPool(parseUnits("0.001"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
  });

  describe("with a little more OS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 20000,
      depositToStrategy: true,
      balancePool: true,
      poolAddOSAmount: 500,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("12000"));
    });
    it("Vault should be able to withdraw all", async () => {
      await assertWithdrawAll();
    });
    it("Vault should be able to partially withdraw", async () => {
      await assertWithdrawPartial(parseUnits("1000"));
    });
    it("Strategist should swap a little assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3"));
    });
    it("Strategist should swap enough wS to get the pool close to balanced", async () => {
      // just under half the extra OS amount
      const osAmount = parseUnits("247");
      await assertSwapAssetsToPool(osAmount);
    });
    it("Strategist should fail to add too much wS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping half the extra OS in the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapAssetsToPool(parseUnits("250"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to add zero wS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      const tx = swapXAMOStrategy.connect(strategist).swapAssetsToPool(0);

      await expect(tx).to.be.revertedWith("Must swap something");
    });
    it("Strategist should fail to add more OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping OS into the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapOTokensToPool(parseUnits("0.001"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
  });

  describe("with a lot more wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: true,
      balancePool: true,
      poolAddwSAmount: 20000,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("6000"));
    });
    it("Vault should be able to withdraw all", async () => {
      await assertWithdrawAll();
    });
    it("Vault should be able to partially withdraw", async () => {
      await assertWithdrawPartial(parseUnits("1000"));
    });
    it("Strategist should swap a little OS to the pool", async () => {
      const osAmount = parseUnits("0.3");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should swap a lot of OS to the pool", async () => {
      const osAmount = parseUnits("5000");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should get the pool close to balanced", async () => {
      // just under half the extra wS amount
      const osAmount = parseUnits("9000");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should fail to add so much OS that is overshoots", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping wS into the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapOTokensToPool(parseUnits("9990"));

      await expect(tx).to.be.revertedWith("OTokens overshot peg");
    });
    it("Strategist should fail to add more wS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping wS into the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapAssetsToPool(parseUnits("0.0001"));

      await expect(tx).to.be.revertedWith("Assets balance worse");
    });
  });

  describe("with a little more wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 20000,
      depositToStrategy: true,
      balancePool: true,
      poolAddwSAmount: 200,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit wS to AMO strategy", async function () {
      await assertDeposit(parseUnits("18000"));
    });
    it("Vault should be able to withdraw all", async () => {
      await assertWithdrawAll();
    });
    it("Vault should be able to partially withdraw", async () => {
      await assertWithdrawPartial(parseUnits("1000"));
    });
    it("Strategist should swap a little OS to the pool", async () => {
      const osAmount = parseUnits("8");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should get the pool close to balanced", async () => {
      // just under half the extra wS amount
      const osAmount = parseUnits("99");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should fail to add zero OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      const tx = swapXAMOStrategy.connect(strategist).swapOTokensToPool(0);

      await expect(tx).to.be.revertedWith("Must swap something");
    });
    it("Strategist should fail to add too much OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Add OS to the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapOTokensToPool(parseUnits("110"));

      await expect(tx).to.be.revertedWith("OTokens overshot peg");
    });
    it("Strategist should fail to add more wS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // try swapping wS into the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .swapAssetsToPool(parseUnits("0.0001"));

      await expect(tx).to.be.revertedWith("Assets balance worse");
    });
  });

  describe("with the strategy owning a small percentage of the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: true,
      balancePool: true,
    });
    let dataBefore;
    beforeEach(async () => {
      fixture = await loadFixture();

      const { clement, wS, oSonic, oSonicVault, swapXPool } = fixture;

      // Other users adds a lot more liquidity to the pool
      const bigAmount = parseUnits("1000000");
      // transfer wS to the pool
      await wS.connect(clement).transfer(swapXPool.address, bigAmount);
      // Mint OS with wS
      await oSonicVault.connect(clement).mint(wS.address, bigAmount.mul(5), 0);
      // transfer OS to the pool
      await oSonic.connect(clement).transfer(swapXPool.address, bigAmount);
      // mint pool LP tokens
      await swapXPool.connect(clement).mint(clement.address);

      dataBefore = await snapData();
      await logSnapData(dataBefore);
    });
    it("a lot of OS is swapped into the pool", async () => {
      const { oSonic, swapXAMOStrategy, wS } = fixture;

      // Swap OS into the pool and wS out
      await poolSwapTokensIn(oSonic, parseUnits("1005000"));

      await logSnapData(await snapData(), "\nAfter swapping OS into the pool");

      // Assert the strategy's balance
      expect(await swapXAMOStrategy.checkBalance(wS.address)).to.equal(
        dataBefore.stratBalance,
        "Strategy's check balance"
      );

      // Swap wS into the pool and OS out
      await poolSwapTokensIn(wS, parseUnits("2000000"));

      await logSnapData(await snapData(), "\nAfter swapping wS into the pool");

      // Assert the strategy's balance
      expect(await swapXAMOStrategy.checkBalance(wS.address)).to.equal(
        dataBefore.stratBalance,
        "Strategy's check balance"
      );
    });
    it("a lot of wS is swapped into the pool", async () => {
      const { swapXAMOStrategy, oSonic, wS } = fixture;

      // Swap wS into the pool and OS out
      await poolSwapTokensIn(wS, parseUnits("1006000"));

      await logSnapData(await snapData(), "\nAfter swapping wS into the pool");

      // Assert the strategy's balance
      expect(await swapXAMOStrategy.checkBalance(wS.address)).to.equal(
        dataBefore.stratBalance,
        "Strategy's check balance"
      );

      // Swap OS into the pool and wS out
      await poolSwapTokensIn(oSonic, parseUnits("1005000"));

      await logSnapData(await snapData(), "\nAfter swapping OS into the pool");

      // Assert the strategy's balance
      expect(await swapXAMOStrategy.checkBalance(wS.address)).to.equal(
        dataBefore.stratBalance,
        "Strategy's check balance"
      );
    });
  });

  const poolSwapTokensIn = async (tokenIn, amountIn) => {
    const { clement, swapXPool, wS } = fixture;
    const amountOut = await swapXPool.getAmountOut(amountIn, tokenIn.address);
    await tokenIn.connect(clement).transfer(swapXPool.address, amountIn);
    if (tokenIn.address == wS.address) {
      await swapXPool.swap(0, amountOut, clement.address, "0x");
    } else {
      await swapXPool.swap(amountOut, 0, clement.address, "0x");
    }
  };

  const precision = parseUnits("1", 18);
  // Calculate the value of wS and OS tokens assuming the pool is balanced
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
    const x = reserves.ws;
    const y = reserves.os;
    const a = x.mul(y).div(precision);
    const b = x.mul(x).div(precision).add(y.mul(y).div(precision));
    const k = a.mul(b).div(precision);

    log(`Invariant: ${formatUnits(k)}`);

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
    const { oSonicVault, swapXAMOStrategy, oSonic, swapXPool, swapXGauge, wS } =
      fixture;

    const stratBalance = await swapXAMOStrategy.checkBalance(wS.address);
    const osSupply = await oSonic.totalSupply();
    const vaultAssets = await oSonicVault.totalValue();
    const poolSupply = await swapXPool.totalSupply();
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();
    const stratGaugeBalance = await swapXGauge.balanceOf(
      swapXAMOStrategy.address
    );
    const gaugeSupply = await swapXGauge.totalSupply();
    const vaultWSBalance = await wS.balanceOf(oSonicVault.address);
    const stratWSBalance = await wS.balanceOf(swapXAMOStrategy.address);

    return {
      stratBalance,
      osSupply,
      vaultAssets,
      poolSupply,
      reserves: { ws: wsReserves, os: osReserves },
      stratGaugeBalance,
      gaugeSupply,
      vaultWSBalance,
      stratWSBalance,
    };
  };

  const logSnapData = async (data, message) => {
    const totalReserves = data.reserves.ws.add(data.reserves.os);
    const reserversPercentage = {
      ws: data.reserves.ws.mul(10000).div(totalReserves),
      os: data.reserves.os.mul(10000).div(totalReserves),
    };
    if (message) {
      log(message);
    }
    log(`Strategy balance    : ${formatUnits(data.stratBalance)}`);
    log(`OS supply           : ${formatUnits(data.osSupply)}`);
    log(`Vault assets        : ${formatUnits(data.vaultAssets)}`);
    log(`pool supply         : ${formatUnits(data.poolSupply)}`);
    log(
      `reserves wS         : ${formatUnits(data.reserves.ws)} ${formatUnits(
        reserversPercentage.ws,
        2
      )}%`
    );
    log(
      `reserves OS         : ${formatUnits(data.reserves.os)} ${formatUnits(
        reserversPercentage.os,
        2
      )}%`
    );
    log(`strat gauge balance : ${formatUnits(data.stratGaugeBalance)}`);
    log(`gauge supply        : ${formatUnits(data.gaugeSupply)}`);
    log(`vault wS balance    : ${formatUnits(data.vaultWSBalance)}`);
    log(`strat wS balance    : ${formatUnits(data.stratWSBalance)}`);
  };

  const logProfit = async (dataBefore) => {
    const { oSonic, oSonicVault } = fixture;

    const osSupplyAfter = await oSonic.totalSupply();
    const vaultAssetsAfter = await oSonicVault.totalValue();
    const profit = vaultAssetsAfter
      .sub(dataBefore.vaultAssets)
      .add(dataBefore.osSupply.sub(osSupplyAfter));
    log(
      `Change vault assets : ${formatUnits(
        vaultAssetsAfter.sub(dataBefore.vaultAssets)
      )}`
    );
    log(
      `Change OS supply    : ${formatUnits(
        dataBefore.osSupply.sub(osSupplyAfter)
      )}`
    );
    log(`Profit              : ${formatUnits(profit)}`);

    return profit;
  };

  const assertChangedData = async (dataBefore, delta) => {
    const { oSonic, oSonicVault, swapXAMOStrategy, swapXPool, swapXGauge, wS } =
      fixture;

    if (delta.stratBalance != undefined) {
      const expectedStratBalance = dataBefore.stratBalance.add(
        delta.stratBalance
      );
      log(`Expected strategy balance: ${formatUnits(expectedStratBalance)}`);
      expect(await swapXAMOStrategy.checkBalance(wS.address)).to.withinRange(
        expectedStratBalance.sub(3),
        expectedStratBalance.add(3),
        "Strategy's check balance"
      );
    }

    if (delta.osSupply != undefined) {
      const expectedSupply = dataBefore.osSupply.add(delta.osSupply);
      expect(await oSonic.totalSupply(), "OSonic total supply").to.equal(
        expectedSupply
      );
    }

    // Check Vault's wS balance
    if (delta.vaultWSBalance != undefined) {
      expect(await wS.balanceOf(oSonicVault.address)).to.equal(
        dataBefore.vaultWSBalance.add(delta.vaultWSBalance),
        "Vault's wS balance"
      );
    }

    // Check the pool's reserves
    if (delta.reserves != undefined) {
      const { _reserve0: wsReserves, _reserve1: osReserves } =
        await swapXPool.getReserves();

      // If the wS reserves delta is a function, call it to check the wS reserves
      if (typeof delta.reserves.ws == "function") {
        // Call test function to check the wS reserves
        delta.reserves.ws(wsReserves);
      } else {
        expect(wsReserves, "wS reserves").to.equal(
          dataBefore.reserves.ws.add(delta.reserves.ws)
        );
      }
      // Check OS reserves delta
      expect(osReserves, "OS reserves").to.equal(
        dataBefore.reserves.os.add(delta.reserves.os)
      );
    }

    if (delta.stratGaugeBalance) {
      // Check the strategy's gauge balance
      const expectedStratGaugeBalance = dataBefore.stratGaugeBalance.add(
        delta.stratGaugeBalance
      );
      expect(
        await swapXGauge.balanceOf(swapXAMOStrategy.address)
      ).to.withinRange(
        expectedStratGaugeBalance.sub(1),
        expectedStratGaugeBalance.add(1),
        "Strategy's gauge balance"
      );
    }
  };

  async function assertDeposit(wsDepositAmount) {
    const {
      clement,
      swapXAMOStrategy,
      oSonic,
      oSonicVault,
      swapXPool,
      oSonicVaultSigner,
      wS,
    } = fixture;

    await oSonicVault.connect(clement).mint(wS.address, wsDepositAmount, 0);

    const dataBefore = await snapData();
    await logSnapData(dataBefore, "\nBefore depositing wS to strategy");

    const { lpMintAmount, osMintAmount } = await calcOSMintAmount(
      wsDepositAmount
    );

    // Vault transfers wS to strategy
    await wS
      .connect(oSonicVaultSigner)
      .transfer(swapXAMOStrategy.address, wsDepositAmount);
    // Vault calls deposit on the strategy
    const tx = await swapXAMOStrategy
      .connect(oSonicVaultSigner)
      .deposit(wS.address, wsDepositAmount);

    await logSnapData(
      await snapData(),
      `\nAfter depositing ${formatUnits(wsDepositAmount)} wS to strategy`
    );
    await logProfit(dataBefore);

    // Check emitted events
    await expect(tx)
      .to.emit(swapXAMOStrategy, "Deposit")
      .withArgs(wS.address, swapXPool.address, wsDepositAmount);
    await expect(tx)
      .to.emit(swapXAMOStrategy, "Deposit")
      .withArgs(oSonic.address, swapXPool.address, osMintAmount);

    // Calculate the value of the wS and OS tokens added to the pool if the pool was balanced
    const depositValue = calcReserveValue({
      ws: wsDepositAmount,
      os: osMintAmount,
    });
    // log(`Value of deposit: ${formatUnits(depositValue)}`);

    await assertChangedData(dataBefore, {
      stratBalance: depositValue,
      osSupply: osMintAmount,
      reserves: { ws: wsDepositAmount, os: osMintAmount },
      vaultWSBalance: wsDepositAmount.mul(-1),
      gaugeSupply: lpMintAmount,
    });
  }

  async function assertWithdrawAll() {
    const { swapXAMOStrategy, swapXPool, oSonic, oSonicVaultSigner, wS } =
      fixture;

    const dataBefore = await snapData();
    await logSnapData(dataBefore);

    const { osBurnAmount, wsWithdrawAmount } = await calcWithdrawAllAmounts();

    // Now try to withdraw all the wS from the strategy
    const tx = await swapXAMOStrategy.connect(oSonicVaultSigner).withdrawAll();

    await logSnapData(await snapData(), "\nAfter full withdraw");
    await logProfit(dataBefore);

    // Check emitted events
    await expect(tx)
      .to.emit(swapXAMOStrategy, "Withdrawal")
      .withArgs(wS.address, swapXPool.address, wsWithdrawAmount);
    await expect(tx)
      .to.emit(swapXAMOStrategy, "Withdrawal")
      .withArgs(oSonic.address, swapXPool.address, osBurnAmount);

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
      stratGaugeBalance: dataBefore.gaugeSupply.mul(-1),
    });
  }

  async function assertWithdrawPartial(wsWithdrawAmount) {
    const {
      swapXAMOStrategy,
      oSonic,
      swapXPool,
      oSonicVault,
      oSonicVaultSigner,
      wS,
    } = fixture;

    const dataBefore = await snapData();

    const { lpBurnAmount, osBurnAmount } = await calcOSWithdrawAmount(
      wsWithdrawAmount
    );

    // Now try to withdraw the wS from the strategy
    const tx = await swapXAMOStrategy
      .connect(oSonicVaultSigner)
      .withdraw(oSonicVault.address, wS.address, wsWithdrawAmount);

    await logSnapData(
      await snapData(),
      `\nAfter withdraw of ${formatUnits(wsWithdrawAmount)}`
    );
    await logProfit(dataBefore);

    // Check emitted events
    await expect(tx)
      .to.emit(swapXAMOStrategy, "Withdrawal")
      .withArgs(wS.address, swapXPool.address, wsWithdrawAmount);
    await expect(tx).to.emit(swapXAMOStrategy, "Withdrawal").withNamedArgs({
      _asset: oSonic.address,
      _pToken: swapXPool.address,
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
            dataBefore.reserves.ws.sub(wsWithdrawAmount);

          expect(actualWsReserve).to.withinRange(
            expectedWsReserves.sub(2),
            expectedWsReserves,
            "wS reserves"
          );
        },
        os: osBurnAmount.mul(-1),
      },
      vaultWSBalance: wsWithdrawAmount,
      gaugeSupply: lpBurnAmount.mul(-1),
    });
  }

  async function assertSwapAssetsToPool(wsAmount) {
    const { swapXAMOStrategy, swapXPool, strategist, wS } = fixture;

    const dataBefore = await snapData();
    await logSnapData(dataBefore, "Before swapping assets to the pool");

    const { lpBurnAmount: expectedLpBurnAmount, osBurnAmount: osBurnAmount1 } =
      await calcOSWithdrawAmount(wsAmount);
    // TODO this is not accurate as the liquidity needs to be removed first
    const osBurnAmount2 = await swapXPool.getAmountOut(wsAmount, wS.address);
    const osBurnAmount = osBurnAmount1.add(osBurnAmount2);

    // Swap wS to the pool and burn the received OS from the pool
    const tx = await swapXAMOStrategy
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
  }

  async function assertSwapOTokensToPool(osAmount) {
    const { swapXAMOStrategy, strategist } = fixture;

    const dataBefore = await snapData();

    // Mint OS and swap into the pool, then mint more OS to add with the wS swapped out
    const tx = await swapXAMOStrategy
      .connect(strategist)
      .swapOTokensToPool(osAmount);

    // Check emitted event
    await expect(tx)
      .emit(swapXAMOStrategy, "SwapOTokensToPool")
      .withNamedArgs({ osMinted: osAmount });

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
  }

  // Calculate the minted OS amount for a deposit
  async function calcOSMintAmount(wsDepositAmount) {
    const { swapXPool } = fixture;

    // Get the reserves of the pool
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();

    const osMintAmount = wsDepositAmount.mul(osReserves).div(wsReserves);
    log(`OS mint amount      : ${formatUnits(osMintAmount)}`);

    const lpTotalSupply = await swapXPool.totalSupply();
    const lpMintAmount = wsDepositAmount.mul(lpTotalSupply).div(wsReserves);

    return { lpMintAmount, osMintAmount };
  }

  // Calculate the amount of OS burnt from a withdraw
  async function calcOSWithdrawAmount(wsWithdrawAmount) {
    const { swapXPool } = fixture;

    // Get the reserves of the pool
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();

    // lp tokens to burn = wS withdrawn * total LP supply / wS pool balance
    const totalLpSupply = await swapXPool.totalSupply();
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
    const { swapXAMOStrategy, swapXGauge, swapXPool } = fixture;

    // Get the reserves of the pool
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();
    const strategyLpAmount = await swapXGauge.balanceOf(
      swapXAMOStrategy.address
    );
    const totalLpSupply = await swapXPool.totalSupply();

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
