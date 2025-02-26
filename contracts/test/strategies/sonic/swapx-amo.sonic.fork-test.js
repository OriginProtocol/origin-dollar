const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const { createFixtureLoader } = require("../../_fixture");
const { swapXAMOFixture } = require("../../_fixture-sonic");
const { units, oethUnits, isCI } = require("../../helpers");
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

    return {
      stratBalance,
      osSupply,
      poolSupply,
      reserves: { ws: wsReserves, os: osReserves },
      stratGaugeBalance,
      vaultWSBalance,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oSonic, oSonicVault, swapXAMOStrategy, swapXPool, swapXGauge, wS } =
      fixture;

    const expectedStratBalance = dataBefore.stratBalance.add(
      delta.stratBalance
    );
    expect(
      await swapXAMOStrategy.checkBalance(wS.address),
      "Strategy's check balance"
    ).to.withinRange(expectedStratBalance.sub(1), expectedStratBalance);
    expect(await oSonic.totalSupply(), "OSonic total supply").to.equal(
      dataBefore.osSupply.add(delta.osSupply)
    );

    // Check the pool's reserves
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

    // Check Vault's wS balance
    expect(
      await wS.balanceOf(oSonicVault.address),
      "Vault's wS balance"
    ).to.equal(dataBefore.vaultWSBalance.add(delta.vaultWSBalance));
  };

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

      const wsDepositAmount = await units("5000", wS);
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

      const wsWithdrawAmount = oethUnits("1000");
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
          osSupply: osBurnAmount.add(1).mul(-1),
          reserves: {
            ws: wsWithdrawAmount.mul(-1),
            os: osBurnAmount.add(1).mul(-1),
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

  describe.skip("with a lot more OS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: false,
      poolAddOethAmount: 60000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should remove a little OS from the pool", async () => {
      await assertRemoveAndBurn(parseUnits("3"), fixture);
    });
    it("Strategist should remove a lot of OS from the pool", async () => {
      const { swapXGauge, swapXAMOStrategy } = fixture;
      const lpBalance = await swapXGauge.balanceOf(swapXAMOStrategy.address);

      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      await assertRemoveAndBurn(lpAmount, fixture);
    });
    it("Strategist should fail to add even more OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Mint and add OS to the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .mintAndAddOTokens(parseUnits("1"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
  });

  describe.skip("with a lot more OS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: false,
      poolAddOethAmount: 6000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should fail to remove the little ETH from the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Remove ETH form the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .removeOnlyAssets(parseUnits("1"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
  });

  describe.skip("with a lot more wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 5000,
      depositToStrategy: false,
      poolAddEthAmount: 200000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should add a little OS to the pool", async () => {
      const oethMintAmount = oethUnits("3");
      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should add a lot of OS to the pool", async () => {
      const oethMintAmount = oethUnits("150000");
      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should add OS to balance the pool", async () => {
      const { swapXPool } = fixture;
      const curveBalances = await swapXPool.get_balances();
      const oethMintAmount = curveBalances[0]
        .sub(curveBalances[1])
        // reduce by 0.001%
        .mul(99999)
        .div(100000);

      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should remove a little ETH from the pool", async () => {
      const lpAmount = parseUnits("2");
      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
    it("Strategist should remove a lot ETH from the pool", async () => {
      const { swapXGauge, swapXAMOStrategy } = fixture;
      const lpBalance = await swapXGauge.balanceOf(swapXAMOStrategy.address);
      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
  });

  describe.skip("with a little more wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 20000,
      depositToStrategy: false,
      poolAddEthAmount: 22000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should remove ETH to balance the pool", async () => {
      const { swapXGauge, swapXAMOStrategy } = fixture;
      const lpBalance = await swapXGauge.balanceOf(swapXAMOStrategy.address);
      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
  });

  describe.skip("with a little more wS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 20000,
      depositToStrategy: true,
      poolAddEthAmount: 8000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should fail to add too much OS to the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Add OS to the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .mintAndAddOTokens(parseUnits("10000"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to remove too much ETH from the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Remove ETH from the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .removeOnlyAssets(parseUnits("8000"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to remove the little OS from the pool", async () => {
      const { swapXAMOStrategy, strategist } = fixture;

      // Remove ETH from the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .removeAndBurnOTokens(parseUnits("1"));

      await expect(tx).to.be.revertedWith("Assets balance worse");
    });
  });

  describe.skip("with a little more OS in the pool", () => {
    const loadFixture = createFixtureLoader(swapXAMOFixture, {
      wsMintAmount: 20000,
      depositToStrategy: false,
      poolAddOethAmount: 5000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should fail to remove too much OS from the pool", async () => {
      const { swapXGauge, swapXAMOStrategy, strategist } = fixture;
      const lpBalance = await swapXGauge.balanceOf(swapXAMOStrategy.address);
      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      // Remove OS from the pool
      const tx = swapXAMOStrategy
        .connect(strategist)
        .removeAndBurnOTokens(lpAmount);

      await expect(tx).to.be.revertedWith("OTokens overshot peg");
    });
  });
});

async function assertRemoveAndBurn(lpAmount, fixture) {
  const { swapXAMOStrategy, swapXPool, oSonic, strategist } = fixture;

  const oethBurnAmount = await calcOSRemoveAmount(fixture, lpAmount);
  const curveBalancesBefore = await swapXPool.get_balances();
  const osSupplyBefore = await oSonic.totalSupply();

  log(`Before remove and burn of ${formatUnits(lpAmount)} OS from the pool`);
  await run("amoStrat", {
    pool: "OS",
    output: false,
  });

  // Remove and burn OS from the pool
  const tx = await swapXAMOStrategy
    .connect(strategist)
    .removeAndBurnOTokens(lpAmount);

  const receipt = await tx.wait();

  log("After remove and burn of OS from pool");
  await run("amoStrat", {
    pool: "OS",
    output: false,
    fromBlock: receipt.blockNumber - 1,
  });

  // Check emitted event
  await expect(tx)
    .to.emit(swapXAMOStrategy, "Withdrawal")
    .withArgs(oSonic.address, swapXPool.address, oethBurnAmount);

  // Check the ETH and OS balances in the Curve pool
  const curveBalancesAfter = await swapXPool.get_balances();
  expect(curveBalancesAfter[0]).to.equal(curveBalancesBefore[0]);
  expect(curveBalancesAfter[1]).to.approxEqualTolerance(
    curveBalancesBefore[1].sub(oethBurnAmount),
    0.01 // 0.01%
  );

  // Check the OS total supply decrease
  expect(await oSonic.totalSupply()).to.approxEqualTolerance(
    osSupplyBefore.sub(oethBurnAmount),
    0.01 // 0.01% or 1 basis point
  );
}

async function assertMintAndAddOTokens(oethMintAmount, fixture) {
  const { swapXAMOStrategy, swapXPool, oSonic, strategist } = fixture;

  const curveBalancesBefore = await swapXPool.get_balances();
  const osSupplyBefore = await oSonic.totalSupply();

  log(`Before mint and add ${formatUnits(oethMintAmount)} OS to the pool`);
  await run("amoStrat", {
    pool: "OS",
    output: false,
  });

  // Mint and add OS to the pool
  const tx = await swapXAMOStrategy
    .connect(strategist)
    .mintAndAddOTokens(oethMintAmount);

  const receipt = await tx.wait();

  // Check emitted event
  await expect(tx)
    .emit(swapXAMOStrategy, "Deposit")
    .withArgs(oSonic.address, swapXPool.address, oethMintAmount);

  log("After mint and add of OS to the pool");
  await run("amoStrat", {
    pool: "OS",
    output: false,
    fromBlock: receipt.blockNumber - 1,
  });

  // Check the ETH and OS balances in the Curve pool
  const curveBalancesAfter = await swapXPool.get_balances();
  expect(curveBalancesAfter[0]).to.approxEqualTolerance(
    curveBalancesBefore[0],
    0.01 // 0.01% or 1 basis point
  );
  expect(curveBalancesAfter[1]).to.approxEqualTolerance(
    curveBalancesBefore[1].add(oethMintAmount),
    0.01 // 0.01%
  );

  // Check the OS total supply decrease
  expect(await oSonic.totalSupply()).to.approxEqualTolerance(
    osSupplyBefore.add(oethMintAmount),
    0.01 // 0.01% or 1 basis point
  );
}

async function assertRemoveOnlyAssets(lpAmount, fixture) {
  const {
    swapXAMOStrategy,
    swapXGauge,
    swapXPool,
    oSonicVault,
    oSonic,
    strategist,
    wS,
  } = fixture;

  log(`Removing ${formatUnits(lpAmount)} ETH from the pool`);
  const ethRemoveAmount = await calcWSRemoveAmount(fixture, lpAmount);
  log("After calc ETH remove amount");
  const curveBalancesBefore = await swapXPool.get_balances();
  const osSupplyBefore = await oSonic.totalSupply();
  const vaultWethBalanceBefore = await wS.balanceOf(oSonicVault.address);
  const strategyLpBalanceBefore = await swapXGauge.balanceOf(
    swapXAMOStrategy.address
  );
  const vaultValueBefore = await oSonicVault.totalValue();

  log(`Before remove and burn of ${formatUnits(lpAmount)} ETH from the pool`);
  await run("amoStrat", {
    pool: "OS",
    output: false,
  });

  // Remove ETH from the pool and transfer to the Vault as WETH
  const tx = await swapXAMOStrategy
    .connect(strategist)
    .removeOnlyAssets(lpAmount);

  const receipt = await tx.wait();

  log("After remove and burn of ETH from pool");
  await run("amoStrat", {
    pool: "OS",
    output: false,
    fromBlock: receipt.blockNumber - 1,
  });

  // Check emitted event
  await expect(tx)
    .to.emit(swapXAMOStrategy, "Withdrawal")
    .withArgs(wS.address, swapXPool.address, ethRemoveAmount);

  // Check the ETH and OS balances in the Curve pool
  const curveBalancesAfter = await swapXPool.get_balances();
  expect(curveBalancesAfter[0]).to.approxEqualTolerance(
    curveBalancesBefore[0].sub(ethRemoveAmount),
    0.01 // 0.01% or 1 basis point
  );
  expect(curveBalancesAfter[1]).to.equal(curveBalancesBefore[1]);

  // Check the OS total supply is the same
  expect(await oSonic.totalSupply()).to.approxEqualTolerance(
    osSupplyBefore,
    0.01 // 0.01% or 1 basis point
  );

  // Check the WETH balance in the Vault
  expect(await wS.balanceOf(oSonicVault.address)).to.equal(
    vaultWethBalanceBefore.add(ethRemoveAmount)
  );

  // Check the vault made money
  const vaultValueAfter = await oSonicVault.totalValue();
  expect(vaultValueAfter.sub(vaultValueBefore)).to.gt(parseUnits("-1"));

  // Check the strategy LP balance decreased
  const strategyLpBalanceAfter = await swapXGauge.balanceOf(
    swapXAMOStrategy.address
  );
  expect(strategyLpBalanceBefore.sub(strategyLpBalanceAfter)).to.eq(lpAmount);
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

// Calculate the amount of OS burned from a removeAndBurnOTokens
async function calcOSRemoveAmount(fixture, lpAmount) {
  const { oethGaugeSigner, swapXPool } = fixture;

  // Static call to get the OS removed from the pool for a given amount of LP tokens
  const oethBurnAmount = await swapXPool
    .connect(oethGaugeSigner)
    .callStatic["remove_liquidity_one_coin(uint256,int128,uint256)"](
      lpAmount,
      1,
      0
    );

  log(`OS burn amount : ${formatUnits(oethBurnAmount)}`);

  return oethBurnAmount;
}

// Calculate the amount of wS burned from a removeOnlyAssets
async function calcWSRemoveAmount(fixture, lpAmount) {
  const { swapXPool } = fixture;

  // Get the ETH removed from the pool for a given amount of LP tokens
  const ethRemoveAmount = await swapXPool.calc_withdraw_one_coin(lpAmount, 0);

  log(`ETH burn amount : ${formatUnits(ethRemoveAmount)}`);

  return ethRemoveAmount;
}
