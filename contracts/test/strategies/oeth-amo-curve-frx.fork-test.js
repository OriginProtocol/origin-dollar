const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { frxEthPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe, isCI } = require("../helpers");
const { createFixtureLoader, convexFrxEthAmoFixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:oeth:amo:curve:frxETH");

forkOnlyDescribe("ForkTest: OETH AMO Curve frxETH/OETH Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("with mainnet data", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { convexFrxETHAMOStrategy } = fixture;

      expect(await convexFrxETHAMOStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );
      expect(await convexFrxETHAMOStrategy.cvxDepositorAddress()).to.equal(
        addresses.mainnet.CVXBooster
      );
      expect(await convexFrxETHAMOStrategy.cvxRewardStaker()).to.equal(
        addresses.mainnet.CVXFrxETHRewardsPool
      );
      expect(await convexFrxETHAMOStrategy.cvxDepositorPTokenId()).to.equal(
        frxEthPoolLpPID
      );
      expect(await convexFrxETHAMOStrategy.curvePool()).to.equal(
        addresses.mainnet.CurveFrxETHOETHPool
      );
      expect(await convexFrxETHAMOStrategy.lpToken()).to.equal(
        addresses.mainnet.CurveFrxETHOETHPool
      );
      expect(await convexFrxETHAMOStrategy.oToken()).to.equal(
        addresses.mainnet.OETHProxy
      );
      expect(await convexFrxETHAMOStrategy.asset()).to.equal(
        addresses.mainnet.frxETH
      );
    });
    it("Should be able to check balance", async () => {
      const { frxETH, josh, convexFrxETHAMOStrategy } = fixture;

      const balance = await convexFrxETHAMOStrategy.checkBalance(
        frxETH.address
      );
      log(`check balance ${balance}`);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await convexFrxETHAMOStrategy
        .connect(josh)
        .populateTransaction.checkBalance(frxETH.address);
      await josh.sendTransaction(tx);
    });
    it.skip("Should be able to harvest the rewards", async function () {
      const {
        josh,
        weth,
        oethHarvester,
        oethDripper,
        oethVault,
        convexFrxETHAMOStrategy,
        crv,
      } = fixture;

      // send some CRV to the strategy to partly simulate reward harvesting
      await crv
        .connect(josh)
        .transfer(convexFrxETHAMOStrategy.address, parseUnits("1000"));

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // prettier-ignore
      await oethHarvester
        .connect(josh)["harvestAndSwap(address)"](convexFrxETHAMOStrategy.address);

      const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
        wethBefore
      );
      await oethVault.connect(josh).rebase();

      await expect(wethDiff).to.be.gte(parseUnits("0.15"));
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        timelock,
        strategist,
        josh,
        oethVaultSigner,
        convexFrxETHAMOStrategy,
        frxETH,
        oeth,
        weth,
        curveFrxEthOethPool,
      } = fixture;

      // Governor can approve all tokens
      const tx = await convexFrxETHAMOStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(frxETH, "Approval");
      await expect(tx).to.emit(oeth, "Approval");
      await expect(tx).to.not.emit(weth, "Approval");
      await expect(tx).to.emit(curveFrxEthOethPool, "Approval");

      for (const signer of [strategist, josh, oethVaultSigner]) {
        const tx = convexFrxETHAMOStrategy
          .connect(signer)
          .safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some frxETH in the vault", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit some frxETH to AMO strategy", async function () {
      const {
        convexFrxETHAMOStrategy,
        oeth,
        curveFrxEthOethPool,
        oethVaultSigner,
        frxETH,
      } = fixture;

      const frxEthDepositAmount = await units("5000", frxETH);

      log(
        `virtual price ${formatUnits(
          await curveFrxEthOethPool.get_virtual_price(),
          18
        )}`
      );

      // Vault transfers frxETH to strategy
      await frxETH
        .connect(oethVaultSigner)
        .transfer(convexFrxETHAMOStrategy.address, frxEthDepositAmount);

      const { oethMintAmount, curveBalances: curveBalancesBefore } =
        await calcOethMintAmount(fixture, frxEthDepositAmount);
      const oethSupplyBefore = await oeth.totalSupply();

      // log("Before deposit to strategy");
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      // });

      // prettier-ignore
      const tx = await convexFrxETHAMOStrategy
        .connect(oethVaultSigner)["deposit(address,uint256)"](frxETH.address, frxEthDepositAmount);

      // log("After deposit to strategy");
      // const receipt = await tx.wait();
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      //   fromBlock: receipt.blockNumber - 1,
      // });

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Deposit")
        .withArgs(
          frxETH.address,
          curveFrxEthOethPool.address,
          frxEthDepositAmount
        );
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Deposit")
        .withArgs(oeth.address, curveFrxEthOethPool.address, oethMintAmount);

      // Check the frxETH and OETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].add(frxEthDepositAmount),
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
    it("Only vault can deposit some frxETH to AMO strategy", async function () {
      const {
        convexFrxETHAMOStrategy,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        frxETH,
      } = fixture;

      const depositAmount = parseUnits("50");
      await frxETH
        .connect(oethVaultSigner)
        .transfer(convexFrxETHAMOStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, josh]) {
        // prettier-ignore
        const tx = convexFrxETHAMOStrategy
          .connect(signer)["deposit(address,uint256)"](frxETH.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all frxETH to AMO strategy", async function () {
      const {
        convexFrxETHAMOStrategy,
        curveFrxEthOethPool,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        frxETH,
      } = fixture;

      const depositAmount = parseUnits("50");
      await frxETH
        .connect(oethVaultSigner)
        .transfer(convexFrxETHAMOStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxETHAMOStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await convexFrxETHAMOStrategy
        .connect(oethVaultSigner)
        .depositAll();
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Deposit")
        .withNamedArgs({
          _asset: frxETH.address,
          _pToken: curveFrxEthOethPool.address,
        });
    });
  });

  describe("with the strategy having some frxETH and OETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should be able to withdraw all", async () => {
      const {
        convexFrxETHAMOStrategy,
        curveFrxEthOethPool,
        oeth,
        oethVaultSigner,
        frxETH,
      } = fixture;

      const {
        oethBurnAmount,
        frxEthWithdrawAmount,
        curveBalances: curveBalancesBefore,
      } = await calcWithdrawAllAmounts(fixture);

      const oethSupplyBefore = await oeth.totalSupply();

      // log("Before withdraw all from strategy");
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      // });

      // Now try to withdraw all the frxETH from the strategy
      const tx = await convexFrxETHAMOStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      // log("After withdraw all from strategy");
      // const receipt = await tx.wait();
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      //   fromBlock: receipt.blockNumber - 1,
      // });

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
        .withArgs(
          frxETH.address,
          curveFrxEthOethPool.address,
          frxEthWithdrawAmount
        );
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
        .withArgs(oeth.address, curveFrxEthOethPool.address, oethBurnAmount);

      // Check the frxETH and OETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(frxEthWithdrawAmount),
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
    it("Vault should be able to withdraw some", async () => {
      const {
        convexFrxETHAMOStrategy,
        oeth,
        curveFrxEthOethPool,
        oethVault,
        oethVaultSigner,
        frxETH,
      } = fixture;

      const withdrawAmount = oethUnits("1000");

      const { oethBurnAmount, curveBalances: curveBalancesBefore } =
        await calcOethWithdrawAmount(fixture, withdrawAmount);
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultFrxEthBalanceBefore = await frxETH.balanceOf(
        oethVault.address
      );

      // log("Before withdraw from strategy");
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      // });

      // Now try to withdraw the frxETH from the strategy
      // prettier-ignore
      const tx = await convexFrxETHAMOStrategy
        .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
          oethVault.address,
          frxETH.address,
          withdrawAmount
        );

      // log("After withdraw from strategy");
      // const receipt = await tx.wait();
      // await run("amoStrat", {
      //   pool: "OETH",
      //   output: false,
      //   fromBlock: receipt.blockNumber - 1,
      // });

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
        .withArgs(frxETH.address, curveFrxEthOethPool.address, withdrawAmount);
      await expect(tx)
        .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
        .withNamedArgs({
          _asset: oeth.address,
          _pToken: curveFrxEthOethPool.address,
        });

      // Check the frxETH and OETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
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

      // Check the frxETH balance in the Vault
      expect(await frxETH.balanceOf(oethVault.address)).to.equal(
        vaultFrxEthBalanceBefore.add(withdrawAmount)
      );
    });
    it("Only vault can withdraw some frxETH from AMO strategy", async function () {
      const {
        convexFrxETHAMOStrategy,
        oethVault,
        strategist,
        timelock,
        josh,
        frxETH,
      } = fixture;

      for (const signer of [strategist, timelock, josh]) {
        // prettier-ignore
        const tx = convexFrxETHAMOStrategy
          .connect(signer)["withdraw(address,address,uint256)"](
            oethVault.address,
            frxETH.address,
            parseUnits("50")
          );

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all frxETH from AMO strategy", async function () {
      const { convexFrxETHAMOStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = convexFrxETHAMOStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = convexFrxETHAMOStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(convexFrxETHAMOStrategy, "Withdrawal");
    });
  });

  describe("with a lot more OETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: false,
      poolAddOethAmount: 4000,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should remove a little OETH from the Curve pool", async () => {
      await assertRemoveAndBurn(parseUnits("3"), fixture);
    });
    it("Strategist should remove a lot of OETH from the Curve pool", async () => {
      await assertRemoveAndBurn(parseUnits("4000"), fixture);
    });
    it("Strategist should fail to add even more OETH to the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Mint and add OETH to the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .mintAndAddOTokens(parseUnits("1"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
    it("Strategist should fail to remove the little frxETH from the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Remove frxETH form the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .removeOnlyAssets(parseUnits("1"));

      await expect(tx).to.be.revertedWith("OTokens balance worse");
    });
  });

  describe("with a lot more frxETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: false,
      poolAddFrxEthAmount: 200000,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should add a little OETH to the Curve pool", async () => {
      const oethMintAmount = oethUnits("3");
      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should add a lot of OETH to the Curve pool", async () => {
      const oethMintAmount = oethUnits("150000");
      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should add OETH to balance the Curve pool", async () => {
      const { curveFrxEthOethPool } = fixture;
      const curveBalances = await curveFrxEthOethPool.get_balances();
      const oethMintAmount = curveBalances[0]
        .sub(curveBalances[1])
        // reduce by 0.0001%
        .mul(999999)
        .div(1000000);

      await assertMintAndAddOTokens(oethMintAmount, fixture);
    });
    it("Strategist should remove a little frxETH from the Curve pool", async () => {
      const lpAmount = parseUnits("2");
      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
    it("Strategist should remove a lot frxETH from the Curve pool", async () => {
      const lpAmount = parseUnits("20000");
      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
  });

  describe("with a little more frxETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: false,
      poolAddFrxEthAmount: 8000,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should remove frxETH to balance the Curve pool", async () => {
      const { curveFrxEthOethPool } = fixture;
      const curveBalances = await curveFrxEthOethPool.get_balances();
      const lpAmount = curveBalances[0]
        .sub(curveBalances[1])
        // reduce by 0.1%
        .mul(999)
        .div(1000);
      expect(lpAmount).to.be.gt(0);

      await assertRemoveOnlyAssets(lpAmount, fixture);
    });
    it("Strategist should fail to add too much OETH to the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Add OETH to the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .mintAndAddOTokens(parseUnits("5000"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to remove too much frxETH from the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Remove frxETH from the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .removeOnlyAssets(parseUnits("5000"));

      await expect(tx).to.be.revertedWith("Assets overshot peg");
    });
    it("Strategist should fail to remove the little OETH from the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Remove frxETH from the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .removeAndBurnOTokens(parseUnits("1"));

      await expect(tx).to.be.revertedWith("Assets balance worse");
    });
  });

  describe("with a little more OETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthAmoFixture, {
      frxEthMintAmount: 5000,
      depositToStrategy: false,
      poolAddOethAmount: 100,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Strategist should fail to remove too much OETH from the Curve pool", async () => {
      const { convexFrxETHAMOStrategy, strategist } = fixture;

      // Remove OETH from the Curve pool
      const tx = convexFrxETHAMOStrategy
        .connect(strategist)
        .removeAndBurnOTokens(parseUnits("8000"));

      await expect(tx).to.be.revertedWith("OTokens overshot peg");
    });
  });
});

async function assertRemoveAndBurn(lpAmount, fixture) {
  const { convexFrxETHAMOStrategy, curveFrxEthOethPool, oeth, strategist } =
    fixture;

  const oethBurnAmount = await calcOethRemoveAmount(fixture, lpAmount);
  const curveBalancesBefore = await curveFrxEthOethPool.get_balances();
  const oethSupplyBefore = await oeth.totalSupply();

  // log(
  //   `Before remove and burn of ${formatUnits(
  //     lpAmount
  //   )} OETH from the Curve pool`
  // );
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  // });

  // Remove and burn OETH from the Curve pool
  const tx = await convexFrxETHAMOStrategy
    .connect(strategist)
    .removeAndBurnOTokens(lpAmount);

  // log("After remove and burn of OETH from Curve pool");
  // const receipt = await tx.wait();
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  //   fromBlock: receipt.blockNumber - 1,
  // });

  // Check emitted event
  await expect(tx)
    .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
    .withArgs(oeth.address, curveFrxEthOethPool.address, oethBurnAmount);

  // Check the frxETH and OETH balances in the Curve Curve pool
  const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
  expect(curveBalancesAfter[0]).to.equal(curveBalancesBefore[0]);
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
}

async function assertMintAndAddOTokens(oethMintAmount, fixture) {
  const { convexFrxETHAMOStrategy, curveFrxEthOethPool, oeth, strategist } =
    fixture;

  const curveBalancesBefore = await curveFrxEthOethPool.get_balances();
  const oethSupplyBefore = await oeth.totalSupply();

  // log(
  //   `Before mint and add ${formatUnits(oethMintAmount)} OETH to the Curve pool`
  // );
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  // });

  // Mint and add OETH to the Curve pool
  const tx = await convexFrxETHAMOStrategy
    .connect(strategist)
    .mintAndAddOTokens(oethMintAmount);

  // Check emitted event
  await expect(tx)
    .emit(convexFrxETHAMOStrategy, "Deposit")
    .withArgs(oeth.address, curveFrxEthOethPool.address, oethMintAmount);

  // log("After mint and add of OETH to the Curve pool");
  // const receipt = await tx.wait();
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  //   fromBlock: receipt.blockNumber - 1,
  // });

  // Check the frxETH and OETH balances in the Curve Curve pool
  const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
  expect(curveBalancesAfter[0]).to.approxEqualTolerance(
    curveBalancesBefore[0],
    0.01 // 0.01% or 1 basis point
  );
  expect(curveBalancesAfter[1]).to.approxEqualTolerance(
    curveBalancesBefore[1].add(oethMintAmount),
    0.01 // 0.01%
  );

  // Check the OETH total supply decrease
  const oethSupplyAfter = await oeth.totalSupply();
  expect(oethSupplyAfter).to.approxEqualTolerance(
    oethSupplyBefore.add(oethMintAmount),
    0.01 // 0.01% or 1 basis point
  );
}

async function assertRemoveOnlyAssets(lpAmount, fixture) {
  const {
    convexFrxETHAMOStrategy,
    cvxRewardPool,
    curveFrxEthOethPool,
    oethVault,
    oeth,
    strategist,
    frxETH,
  } = fixture;

  log(`Removing ${formatUnits(lpAmount)} frxETH from the Curve pool`);
  const frxEthRemoveAmount = await calcEthRemoveAmount(fixture, lpAmount);
  log("After calc frxETH remove amount");
  const curveBalancesBefore = await curveFrxEthOethPool.get_balances();
  const oethSupplyBefore = await oeth.totalSupply();
  const vaultFrxEthBalanceBefore = await frxETH.balanceOf(oethVault.address);
  const strategyLpBalanceBefore = await cvxRewardPool.balanceOf(
    convexFrxETHAMOStrategy.address
  );
  const vaultValueBefore = await oethVault.totalValue();

  // log(
  //   `Before remove and burn of ${formatUnits(lpAmount)} frxETH from the Curve pool`
  // );
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  // });

  // Remove frxETH from the Curve pool and transfer to the Vault
  const tx = await convexFrxETHAMOStrategy
    .connect(strategist)
    .removeOnlyAssets(lpAmount);

  // log("After remove and burn of frxETH from Curve pool");
  // const receipt = await tx.wait();
  // await run("amoStrat", {
  //   pool: "OETH",
  //   output: false,
  //   fromBlock: receipt.blockNumber - 1,
  // });

  // Check emitted event
  await expect(tx)
    .to.emit(convexFrxETHAMOStrategy, "Withdrawal")
    .withArgs(frxETH.address, curveFrxEthOethPool.address, frxEthRemoveAmount);

  // Check the frxETH and OETH balances in the Curve pool
  const curveBalancesAfter = await curveFrxEthOethPool.get_balances();
  expect(curveBalancesAfter[0]).to.approxEqualTolerance(
    curveBalancesBefore[0].sub(frxEthRemoveAmount),
    0.01 // 0.01% or 1 basis point
  );
  expect(curveBalancesAfter[1]).to.equal(curveBalancesBefore[1]);

  // Check the OETH total supply is the same
  const oethSupplyAfter = await oeth.totalSupply();
  expect(oethSupplyAfter).to.approxEqualTolerance(
    oethSupplyBefore,
    0.01 // 0.01% or 1 basis point
  );

  // Check the frxETH balance in the Vault
  expect(await frxETH.balanceOf(oethVault.address)).to.equal(
    vaultFrxEthBalanceBefore.add(frxEthRemoveAmount)
  );

  // Check the vault made money
  const vaultValueAfter = await oethVault.totalValue();
  expect(vaultValueAfter.sub(vaultValueBefore)).to.gt(parseUnits("-1"));

  // Check the strategy LP balance decreased
  const strategyLpBalanceAfter = await cvxRewardPool.balanceOf(
    convexFrxETHAMOStrategy.address
  );
  expect(strategyLpBalanceBefore.sub(strategyLpBalanceAfter)).to.eq(lpAmount);
}

// Calculate the minted OETH amount for a deposit
async function calcOethMintAmount(fixture, frxEthDepositAmount) {
  const { curveFrxEthOethPool } = fixture;

  // Get the frxETH and OETH balances in the Curve pool
  const curveBalances = await curveFrxEthOethPool.get_balances();
  // frxETH balance - OETH balance
  const balanceDiff = curveBalances[0].sub(curveBalances[1]);

  let oethMintAmount = balanceDiff.lte(0)
    ? // If more OETH than frxETH then mint same amount of OETH as frxETH
      frxEthDepositAmount
    : // If less OETH than frxETH then mint the difference
      balanceDiff.add(frxEthDepositAmount);
  // Cap the minting to twice the frxETH deposit amount
  const doubleFrxEthDepositAmount = frxEthDepositAmount.mul(2);
  oethMintAmount = oethMintAmount.lte(doubleFrxEthDepositAmount)
    ? oethMintAmount
    : doubleFrxEthDepositAmount;
  log(`OETH mint amount : ${formatUnits(oethMintAmount)}`);

  return { oethMintAmount, curveBalances };
}

// Calculate the amount of OETH burnt from a withdraw
async function calcOethWithdrawAmount(fixture, frxEthWithdrawAmount) {
  const { curveFrxEthOethPool } = fixture;

  // Get the frxETH and OETH balances in the Curve pool
  const curveBalances = await curveFrxEthOethPool.get_balances();

  // OETH to burn = frxETH withdrawn * OETH pool balance / frxETH pool balance
  const oethBurnAmount = frxEthWithdrawAmount
    .mul(curveBalances[1])
    .div(curveBalances[0]);

  log(`OETH burn amount : ${formatUnits(oethBurnAmount)}`);

  return { oethBurnAmount, curveBalances };
}

// Calculate the OETH and frxETH amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const { convexFrxETHAMOStrategy, cvxRewardPool, curveFrxEthOethPool } =
    fixture;

  // Get the frxETH and OETH balances in the Curve pool
  const curveBalances = await curveFrxEthOethPool.get_balances();
  const strategyLpAmount = await cvxRewardPool.balanceOf(
    convexFrxETHAMOStrategy.address
  );
  const totalLpSupply = await curveFrxEthOethPool.totalSupply();

  // OETH to burn = OETH pool balance * strategy LP amount / total pool LP amount
  const oethBurnAmount = curveBalances[1]
    .mul(strategyLpAmount)
    .div(totalLpSupply);
  // frxETH to withdraw = frxETH pool balance * strategy LP amount / total pool LP amount
  const frxEthWithdrawAmount = curveBalances[0]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  log(`OETH burn amount      : ${formatUnits(oethBurnAmount)}`);
  log(`frxETH withdraw amount: ${formatUnits(frxEthWithdrawAmount)}`);

  return { oethBurnAmount, frxEthWithdrawAmount, curveBalances };
}

// Calculate the amount of OETH burned from a removeAndBurnOTokens
async function calcOethRemoveAmount(fixture, lpAmount) {
  const { curveFrxETHOETHGaugeSigner, curveFrxEthOethPool } = fixture;

  // Static call to get the OETH removed from the Curve pool for a given amount of LP tokens
  const oethBurnAmount = await curveFrxEthOethPool
    .connect(curveFrxETHOETHGaugeSigner)
    .callStatic["remove_liquidity_one_coin(uint256,int128,uint256)"](
      lpAmount,
      1,
      0
    );

  log(`OETH burn amount : ${formatUnits(oethBurnAmount)}`);

  return oethBurnAmount;
}

// Calculate the amount of frxETH burned from a removeOnlyAssets
async function calcEthRemoveAmount(fixture, lpAmount) {
  const { curveFrxEthOethPool } = fixture;

  // Get the frxETH removed from the Curve pool for a given amount of LP tokens
  const ethRemoveAmount = await curveFrxEthOethPool.calc_withdraw_one_coin(
    lpAmount,
    0
  );

  log(`frxETH burn amount : ${formatUnits(ethRemoveAmount)}`);

  return ethRemoveAmount;
}
