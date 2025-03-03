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

  describe("with some wS in the vault", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: false,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit some wS to AMO strategy", async function () {
      const { swapXAMOStrategy, oSonic, swapXPool, oSonicVaultSigner, wS } =
        fixture;

      const dataBefore = await snapData(fixture);

      const wsDepositAmount = await parseUnits("5000");
      const osMintAmount = await calcOSMintAmount(fixture, wsDepositAmount);

      // Vault transfers wS to strategy
      await wS
        .connect(oSonicVaultSigner)
        .transfer(swapXAMOStrategy.address, wsDepositAmount);
      // Vault calls deposit on the strategy
      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .deposit(wS.address, wsDepositAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Deposit")
        .withArgs(wS.address, swapXPool.address, wsDepositAmount);
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Deposit")
        .withArgs(oSonic.address, swapXPool.address, osMintAmount);

      await assertChangedData(
        dataBefore,
        {
          stratBalance: wsDepositAmount.add(osMintAmount).sub(1),
          osSupply: osMintAmount,
          reserves: { ws: wsDepositAmount, os: osMintAmount },
          vaultWSBalance: wsDepositAmount.mul(-1),
        },
        fixture
      );
    });
    it("Only vault can deposit some wS to AMO strategy", async function () {
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

  describe("with the strategy having some OS and wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: true,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should be able to withdraw all", async () => {
      const { swapXAMOStrategy, swapXPool, oSonic, oSonicVaultSigner, wS } =
        fixture;

      const dataBefore = await snapData(fixture);

      const { osBurnAmount, wsWithdrawAmount } = await calcWithdrawAllAmounts(
        fixture
      );

      // Now try to withdraw all the wS from the strategy
      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .withdrawAll();

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(wS.address, swapXPool.address, wsWithdrawAmount);
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(oSonic.address, swapXPool.address, osBurnAmount);

      await assertChangedData(
        dataBefore,
        {
          stratBalance: wsWithdrawAmount.add(osBurnAmount).mul(-1),
          osSupply: osBurnAmount.mul(-1),
          reserves: { ws: wsWithdrawAmount.mul(-1), os: osBurnAmount.mul(-1) },
          vaultWSBalance: wsWithdrawAmount,
        },
        fixture
      );
    });
    it("Vault should be able to withdraw some", async () => {
      const {
        swapXAMOStrategy,
        oSonic,
        swapXPool,
        oSonicVault,
        oSonicVaultSigner,
        wS,
      } = fixture;

      const dataBefore = await snapData(fixture);

      const wsWithdrawAmount = parseUnits("1000");
      const osBurnAmount = await calcOSWithdrawAmount(
        fixture,
        wsWithdrawAmount
      );

      // Now try to withdraw the wS from the strategy
      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .withdraw(oSonicVault.address, wS.address, wsWithdrawAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(wS.address, swapXPool.address, wsWithdrawAmount);
      await expect(tx).to.emit(swapXAMOStrategy, "Withdrawal").withNamedArgs({
        _asset: oSonic.address,
        _pToken: swapXPool.address,
      });

      await assertChangedData(
        dataBefore,
        {
          stratBalance: wsWithdrawAmount.add(osBurnAmount).mul(-1),
          osSupply: osBurnAmount.mul(-1),
          reserves: {
            ws: wsWithdrawAmount.mul(-1),
            os: osBurnAmount.mul(-1),
          },
          vaultWSBalance: wsWithdrawAmount,
        },
        fixture
      );
    });
    it("Only vault can withdraw some WETH from AMO strategy", async function () {
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
    it("Strategist should swap a little assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3"), fixture);
    });
    it("Strategist should swap a lot of assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3000"), fixture);
    });
    it("Strategist should swap most of the wS owned by the strategy", async () => {
      await assertSwapAssetsToPool(parseUnits("4500"), fixture);
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
    it("Strategist should swap a little assets to the pool", async () => {
      await assertSwapAssetsToPool(parseUnits("3"), fixture);
    });
    it("Strategist should swap enough wS to get the pool close to balanced", async () => {
      // just under half the extra OS amount
      const osAmount = parseUnits("247");
      await assertSwapAssetsToPool(osAmount, fixture);
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

      await expect(tx).to.be.revertedWith("Must swap some wS");
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
    it("Strategist should add a little OS to the pool", async () => {
      const osAmount = parseUnits("0.3");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should add a lot of OS to the pool", async () => {
      const osAmount = parseUnits("5000");
      await assertSwapOTokensToPool(osAmount, fixture);
    });
    it("Strategist should get the pool close to balanced", async () => {
      // just under half the extra wS amount
      const osAmount = parseUnits("9300");
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
    it("Strategist should add a little OS to the pool", async () => {
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

      await expect(tx).to.be.revertedWith("Must swap some OS");
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
});

const snapData = async (fixture) => {
  const { oSonicVault, swapXAMOStrategy, oSonic, swapXPool, swapXGauge, wS } =
    fixture;

  const stratBalance = await swapXAMOStrategy.checkBalance(wS.address);
  const osSupply = await oSonic.totalSupply();
  const poolSupply = await swapXPool.totalSupply();
  const { _reserve0: wsReserves, _reserve1: osReserves } =
    await swapXPool.getReserves();
  const stratGaugeBalance = await swapXGauge.balanceOf(
    swapXAMOStrategy.address
  );
  const vaultWSBalance = await wS.balanceOf(oSonicVault.address);
  const stratWSBalance = await wS.balanceOf(swapXAMOStrategy.address);

  return {
    stratBalance,
    osSupply,
    poolSupply,
    reserves: { ws: wsReserves, os: osReserves },
    stratGaugeBalance,
    vaultWSBalance,
    stratWSBalance,
  };
};

const assertChangedData = async (dataBefore, delta, fixture) => {
  const { oSonic, oSonicVault, swapXAMOStrategy, swapXPool, swapXGauge, wS } =
    fixture;

  if (delta.stratBalance != undefined) {
    const expectedStratBalance = dataBefore.stratBalance.add(
      delta.stratBalance
    );
    expect(
      await swapXAMOStrategy.checkBalance(wS.address),
      "Strategy's check balance"
    ).to.withinRange(expectedStratBalance.sub(1), expectedStratBalance);
  }

  if (delta.osSupply != undefined) {
    const expectedSupply = dataBefore.osSupply.add(delta.osSupply);
    expect(await oSonic.totalSupply(), "OSonic total supply").to.equal(
      expectedSupply
    );
  }

  // Check the pool's reserves
  if (delta.reserves != undefined) {
    const { _reserve0: wsReserves, _reserve1: osReserves } =
      await swapXPool.getReserves();
    expect(wsReserves, "wS reserves").to.equal(
      dataBefore.reserves.ws.add(delta.reserves.ws)
    );
    expect(osReserves, "OS reserves").to.equal(
      dataBefore.reserves.os.add(delta.reserves.os)
    );

    // Check the strategy's gauge balance
    // Calculate the liquidity added to the pool
    const wsLiquidity = delta.reserves.ws
      .mul(dataBefore.poolSupply)
      .div(dataBefore.reserves.ws);
    const osLiquidity = delta.reserves.os
      .mul(dataBefore.poolSupply)
      .div(dataBefore.reserves.os);
    const deltaStratGaugeBalance = wsLiquidity.lt(osLiquidity)
      ? wsLiquidity
      : osLiquidity;
    const expectedStratGaugeBalance = dataBefore.stratGaugeBalance.add(
      deltaStratGaugeBalance
    );
    expect(
      await swapXGauge.balanceOf(swapXAMOStrategy.address),
      "Strategy's gauge balance"
    ).to.withinRange(
      expectedStratGaugeBalance.sub(1),
      expectedStratGaugeBalance.add(1)
    );
  }

  // Check Vault's wS balance
  if (delta.vaultWSBalance != undefined) {
    expect(
      await wS.balanceOf(oSonicVault.address),
      "Vault's wS balance"
    ).to.equal(dataBefore.vaultWSBalance.add(delta.vaultWSBalance));
  }
};

async function assertSwapAssetsToPool(wsAmount, fixture) {
  const { swapXAMOStrategy, strategist } = fixture;

  const dataBefore = await snapData(fixture);

  // Swap wS to the pool and burn the received OS from the pool
  const tx = await swapXAMOStrategy
    .connect(strategist)
    .swapAssetsToPool(wsAmount);

  // Check emitted event
  await expect(tx).to.emittedEvent("SwapAssetsToPool", [
    wsAmount,
    (lpTokens) => {
      expect(lpTokens).to.approxEqualTolerance(wsAmount, 5);
    },
    (osBurnt) => {
      // TODO narrow down the range
      expect(osBurnt).to.gt(wsAmount, 1);
    },
  ]);

  await assertChangedData(
    dataBefore,
    {
      vaultWSBalance: 0,
    },
    fixture
  );
}

async function assertSwapOTokensToPool(osAmount, fixture) {
  const { swapXAMOStrategy, strategist } = fixture;

  // Mint OS and swap into the pool, then mint more OS to add with the wS swapped out
  const tx = await swapXAMOStrategy
    .connect(strategist)
    .swapOTokensToPool(osAmount);

  // Check emitted event
  await expect(tx)
    .emit(swapXAMOStrategy, "SwapOTokensToPool")
    .withNamedArgs({ osMinted: osAmount });
}

// Calculate the minted OS amount for a deposit
async function calcOSMintAmount(fixture, wsDepositAmount) {
  const { swapXPool } = fixture;

  // Get the reserves of the pool
  const { _reserve0: wsReserves, _reserve1: osReserves } =
    await swapXPool.getReserves();

  const osMintAmount = wsDepositAmount.mul(osReserves).div(wsReserves);
  log(`OS mint amount : ${formatUnits(osMintAmount)}`);

  return osMintAmount;
}

// Calculate the amount of OS burnt from a withdraw
async function calcOSWithdrawAmount(fixture, wethWithdrawAmount) {
  const { swapXPool } = fixture;

  // Get the reserves of the pool
  const { _reserve0: wsReserves, _reserve1: osReserves } =
    await swapXPool.getReserves();

  // OS to burn = wS withdrawn * OS reserves / wS reserves
  const osBurnAmount = wethWithdrawAmount.mul(osReserves).div(wsReserves);

  log(`OS burn amount : ${formatUnits(osBurnAmount)}`);

  return osBurnAmount;
}

// Calculate the OS and wS amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const { swapXAMOStrategy, swapXGauge, swapXPool } = fixture;

  // Get the reserves of the pool
  const { _reserve0: wsReserves, _reserve1: osReserves } =
    await swapXPool.getReserves();
  const strategyLpAmount = await swapXGauge.balanceOf(swapXAMOStrategy.address);
  const totalLpSupply = await swapXPool.totalSupply();

  // wS to withdraw = wS pool balance * strategy LP amount / total pool LP amount
  const wsWithdrawAmount = wsReserves.mul(strategyLpAmount).div(totalLpSupply);
  // OS to burn = OS pool balance * strategy LP amount / total pool LP amount
  const osBurnAmount = osReserves.mul(strategyLpAmount).div(totalLpSupply);

  log(`wS withdraw amount : ${formatUnits(wsWithdrawAmount)}`);
  log(`OS burn amount    : ${formatUnits(osBurnAmount)}`);

  return {
    wsWithdrawAmount,
    osBurnAmount,
  };
}
