const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const { createFixtureLoader } = require("../../_fixture");
const {
  defaultSonicFixture,
  swapXAMOFixture,
} = require("../../_fixture-sonic");
const { units, oethUnits, isCI } = require("../../helpers");
const addresses = require("../../../utils/addresses");

const log = require("../../../utils/logger")("test:fork:sonic:swapx:amo");

describe("Sonic ForkTest: SwapX AMO Strategy", function () {
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(defaultSonicFixture);
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

  describe.skip("with some wS in the vault", () => {
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

      const wsDepositAmount = await units("5000", wS);

      // Vault transfers WETH to strategy
      await wS
        .connect(oSonicVaultSigner)
        .transfer(swapXAMOStrategy.address, wsDepositAmount);

      const { osMintAmount, curveBalances: curveBalancesBefore } =
        await calcOSMintAmount(fixture, wsDepositAmount);
      const osSupplyBefore = await oSonic.totalSupply();

      //   log("Before deposit to strategy");
      //   await run("amoStrat", {
      //     pool: "OS",
      //     output: false,
      //   });

      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .deposit(wS.address, wsDepositAmount);

      //   const receipt = await tx.wait();

      //   log("After deposit to strategy");
      //   await run("amoStrat", {
      //     pool: "OS",
      //     output: false,
      //     fromBlock: receipt.blockNumber - 1,
      //   });

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Deposit")
        .withArgs(wS.address, swapXPool.address, wsDepositAmount);
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Deposit")
        .withArgs(oSonic.address, swapXPool.address, osMintAmount);

      // Check the ETH and OS balances in the Curve pool
      const curveBalancesAfter = await swapXPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].add(wsDepositAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].add(osMintAmount),
        0.01 // 0.01% or 1 basis point
      );

      // Check the OS total supply increase
      const oethSupplyAfter = await oSonic.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        osSupplyBefore.add(osMintAmount),
        0.01 // 0.01% or 1 basis point
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

  describe.skip("with the strategy having some OS and wS in the pool", () => {
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
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

      const {
        oethBurnAmount,
        ethWithdrawAmount,
        curveBalances: curveBalancesBefore,
      } = await calcWithdrawAllAmounts(fixture);

      const oethSupplyBefore = await oSonic.totalSupply();

      log("Before withdraw all from strategy");
      await run("amoStrat", {
        pool: "OS",
        output: false,
      });

      // Now try to withdraw all the WETH from the strategy
      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .withdrawAll();

      const receipt = await tx.wait();

      log("After withdraw all from strategy");
      await run("amoStrat", {
        pool: "OS",
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(wS.address, swapXPool.address, ethWithdrawAmount);
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(oSonic.address, swapXPool.address, oethBurnAmount);

      // Check the ETH and OS balances in the Curve pool
      const curveBalancesAfter = await swapXPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(ethWithdrawAmount),
        0.05 // 0.05% or 5 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].sub(oethBurnAmount),
        0.05 // 0.05%
      );

      // Check the OS total supply decrease
      const oethSupplyAfter = await oSonic.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.05 // 0.01% or 5 basis point
      );
    });
    it("Vault should be able to withdraw some", async () => {
      const {
        swapXAMOStrategy,
        oSonic,
        swapXPool,
        oethVault,
        oSonicVaultSigner,
        wS,
      } = fixture;

      const withdrawAmount = oethUnits("1000");

      const { oethBurnAmount, curveBalances: curveBalancesBefore } =
        await calcOethWithdrawAmount(fixture, withdrawAmount);
      const oethSupplyBefore = await oSonic.totalSupply();
      const vaultWethBalanceBefore = await wS.balanceOf(oethVault.address);

      log("Before withdraw from strategy");
      await run("amoStrat", {
        pool: "OS",
        output: false,
      });

      // Now try to withdraw the WETH from the strategy
      const tx = await swapXAMOStrategy
        .connect(oSonicVaultSigner)
        .withdraw(oethVault.address, wS.address, withdrawAmount);

      const receipt = await tx.wait();

      log("After withdraw from strategy");
      await run("amoStrat", {
        pool: "OS",
        output: false,
        fromBlock: receipt.blockNumber - 1,
      });

      // Check emitted events
      await expect(tx)
        .to.emit(swapXAMOStrategy, "Withdrawal")
        .withArgs(wS.address, swapXPool.address, withdrawAmount);
      await expect(tx).to.emit(swapXAMOStrategy, "Withdrawal").withNamedArgs({
        _asset: oSonic.address,
        _pToken: swapXPool.address,
      });

      // Check the ETH and OS balances in the Curve pool
      const curveBalancesAfter = await swapXPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(withdrawAmount),
        0.05 // 0.05% or 5 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].sub(oethBurnAmount),
        0.05 // 0.05%
      );

      // Check the OS total supply decrease
      const oethSupplyAfter = await oSonic.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.sub(oethBurnAmount),
        0.05 // 0.05% or 5 basis point
      );

      // Check the WETH balance in the Vault
      expect(await wS.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some WETH from AMO strategy", async function () {
      const { swapXAMOStrategy, oethVault, strategist, timelock, nick, wS } =
        fixture;

      for (const signer of [strategist, timelock, nick]) {
        const tx = swapXAMOStrategy
          .connect(signer)
          .withdraw(oethVault.address, wS.address, parseUnits("50"));

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
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
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
      const { cvxRewardPool, swapXAMOStrategy } = fixture;
      const lpBalance = await cvxRewardPool.balanceOf(swapXAMOStrategy.address);

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
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
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
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
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
      const { cvxRewardPool, swapXAMOStrategy } = fixture;
      const lpBalance = await cvxRewardPool.balanceOf(swapXAMOStrategy.address);
      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
  });

  describe.skip("with a little more wS in the pool", () => {
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
      wsMintAmount: 20000,
      depositToStrategy: false,
      poolAddEthAmount: 22000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should remove ETH to balance the pool", async () => {
      const { cvxRewardPool, swapXAMOStrategy } = fixture;
      const lpBalance = await cvxRewardPool.balanceOf(swapXAMOStrategy.address);
      const lpAmount = lpBalance
        // reduce by 1%
        .mul(99)
        .div(100);

      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
  });

  describe.skip("with a little more wS in the pool", () => {
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
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
    const loadFixture = createFixtureLoader(defaultSonicFixture, {
      wsMintAmount: 20000,
      depositToStrategy: false,
      poolAddOethAmount: 5000,
      balancePool: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should fail to remove too much OS from the pool", async () => {
      const { cvxRewardPool, swapXAMOStrategy, strategist } = fixture;
      const lpBalance = await cvxRewardPool.balanceOf(swapXAMOStrategy.address);
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

  const oethBurnAmount = await calcOethRemoveAmount(fixture, lpAmount);
  const curveBalancesBefore = await swapXPool.get_balances();
  const oethSupplyBefore = await oSonic.totalSupply();

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
  const oethSupplyAfter = await oSonic.totalSupply();
  expect(oethSupplyAfter).to.approxEqualTolerance(
    oethSupplyBefore.sub(oethBurnAmount),
    0.01 // 0.01% or 1 basis point
  );
}

async function assertMintAndAddOTokens(oethMintAmount, fixture) {
  const { swapXAMOStrategy, swapXPool, oSonic, strategist } = fixture;

  const curveBalancesBefore = await swapXPool.get_balances();
  const oethSupplyBefore = await oSonic.totalSupply();

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
  const oethSupplyAfter = await oSonic.totalSupply();
  expect(oethSupplyAfter).to.approxEqualTolerance(
    oethSupplyBefore.add(oethMintAmount),
    0.01 // 0.01% or 1 basis point
  );
}

async function assertRemoveOnlyAssets(lpAmount, fixture) {
  const {
    swapXAMOStrategy,
    cvxRewardPool,
    swapXPool,
    oethVault,
    oSonic,
    strategist,
    wS,
  } = fixture;

  log(`Removing ${formatUnits(lpAmount)} ETH from the pool`);
  const ethRemoveAmount = await calcEthRemoveAmount(fixture, lpAmount);
  log("After calc ETH remove amount");
  const curveBalancesBefore = await swapXPool.get_balances();
  const oethSupplyBefore = await oSonic.totalSupply();
  const vaultWethBalanceBefore = await wS.balanceOf(oethVault.address);
  const strategyLpBalanceBefore = await cvxRewardPool.balanceOf(
    swapXAMOStrategy.address
  );
  const vaultValueBefore = await oethVault.totalValue();

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
  const oethSupplyAfter = await oSonic.totalSupply();
  expect(oethSupplyAfter).to.approxEqualTolerance(
    oethSupplyBefore,
    0.01 // 0.01% or 1 basis point
  );

  // Check the WETH balance in the Vault
  expect(await wS.balanceOf(oethVault.address)).to.equal(
    vaultWethBalanceBefore.add(ethRemoveAmount)
  );

  // Check the vault made money
  const vaultValueAfter = await oethVault.totalValue();
  expect(vaultValueAfter.sub(vaultValueBefore)).to.gt(parseUnits("-1"));

  // Check the strategy LP balance decreased
  const strategyLpBalanceAfter = await cvxRewardPool.balanceOf(
    swapXAMOStrategy.address
  );
  expect(strategyLpBalanceBefore.sub(strategyLpBalanceAfter)).to.eq(lpAmount);
}

// Calculate the minted OS amount for a deposit
async function calcOSMintAmount(fixture, wsDepositAmount) {
  const { swapXPool } = fixture;

  // Get the wS and OS balances in the pool
  const { _reserve0: wsReserves, _reserve1: osReserves } =
    await swapXPool.getReserves();
  console.log("wsBalance", wsReserves);
  console.log("osBalance", osReserves);
  // wS balance - OS balance
  const balanceDiff = wsReserves.sub(osReserves);

  let osMintAmount = balanceDiff.lte(0)
    ? // If more OS than wS then mint same amount of OS as wS
      wsDepositAmount
    : // If less OS than wS then mint the difference
      balanceDiff.add(wsDepositAmount);
  // Cap the minting to twice the ETH deposit amount
  const doubleWethDepositAmount = wsDepositAmount.mul(2);
  osMintAmount = osMintAmount.lte(doubleWethDepositAmount)
    ? osMintAmount
    : doubleWethDepositAmount;
  log(`OS mint amount : ${formatUnits(osMintAmount)}`);

  return { osMintAmount, wsReserves, osReserves };
}

// Calculate the amount of OS burnt from a withdraw
async function calcOethWithdrawAmount(fixture, wethWithdrawAmount) {
  const { swapXPool } = fixture;

  // Get the ETH and OS balances in the Curve pool
  const curveBalances = await swapXPool.get_balances();

  // OS to burn = WETH withdrawn * OS pool balance / ETH pool balance
  const oethBurnAmount = wethWithdrawAmount
    .mul(curveBalances[1])
    .div(curveBalances[0]);

  log(`OS burn amount : ${formatUnits(oethBurnAmount)}`);

  return { oethBurnAmount, curveBalances };
}

// Calculate the OS and ETH amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const { swapXAMOStrategy, cvxRewardPool, swapXPool } = fixture;

  // Get the ETH and OS balances in the Curve pool
  const curveBalances = await swapXPool.get_balances();
  const strategyLpAmount = await cvxRewardPool.balanceOf(
    swapXAMOStrategy.address
  );
  const totalLpSupply = await swapXPool.totalSupply();

  // OS to burn = OS pool balance * strategy LP amount / total pool LP amount
  const oethBurnAmount = curveBalances[1]
    .mul(strategyLpAmount)
    .div(totalLpSupply);
  // ETH to withdraw = ETH pool balance * strategy LP amount / total pool LP amount
  const ethWithdrawAmount = curveBalances[0]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  log(`OS burn amount    : ${formatUnits(oethBurnAmount)}`);
  log(`ETH withdraw amount : ${formatUnits(ethWithdrawAmount)}`);

  return { oethBurnAmount, ethWithdrawAmount, curveBalances };
}

// Calculate the amount of OS burned from a removeAndBurnOTokens
async function calcOethRemoveAmount(fixture, lpAmount) {
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

// Calculate the amount of ETH burned from a removeOnlyAssets
async function calcEthRemoveAmount(fixture, lpAmount) {
  const { swapXPool } = fixture;

  // Get the ETH removed from the pool for a given amount of LP tokens
  const ethRemoveAmount = await swapXPool.calc_withdraw_one_coin(lpAmount, 0);

  log(`ETH burn amount : ${formatUnits(ethRemoveAmount)}`);

  return ethRemoveAmount;
}
