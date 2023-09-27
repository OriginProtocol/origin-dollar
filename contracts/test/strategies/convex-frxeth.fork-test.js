const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { frxEthWethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe, isCI } = require("../helpers");
const {
  createFixtureLoader,
  convexFrxEthFixture,
  loadDefaultFixture,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:convex:frxETH");

forkOnlyDescribe("ForkTest: Convex frxETH/WETH Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("with mainnet data", () => {
    beforeEach(async () => {
      fixture = await loadDefaultFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { convexFrxEthWethStrategy } = fixture;

      expect(await convexFrxEthWethStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );

      expect(await convexFrxEthWethStrategy.cvxDepositor()).to.equal(
        addresses.mainnet.CVXBooster
      );
      expect(await convexFrxEthWethStrategy.cvxRewardStaker()).to.equal(
        addresses.mainnet.ConvexFrxEthWethRewardsPool
      );
      expect(await convexFrxEthWethStrategy.cvxDepositorPoolId()).to.equal(
        frxEthWethPoolLpPID
      );
      expect(await convexFrxEthWethStrategy.platformAddress()).to.equal(
        addresses.mainnet.CurveFrxEthWethPool
      );
    });
    it("Should be able to check balances", async () => {
      const { frxETH, weth, josh, convexFrxEthWethStrategy } = fixture;

      expect(await convexFrxEthWethStrategy.checkBalance(weth.address)).gte(0);

      expect(await convexFrxEthWethStrategy.checkBalance(frxETH.address)).gte(
        0
      );

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await convexFrxEthWethStrategy
        .connect(josh)
        .populateTransaction.checkBalance(weth.address);
      await josh.sendTransaction(tx);
    });
  });

  describe("with no assets in the vault", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should be able to harvest the rewards", async function () {
      const {
        josh,
        weth,
        oethHarvester,
        oethDripper,
        oethVault,
        convexFrxEthWethStrategy,
        crv,
      } = fixture;

      // send some CRV to the strategy to partly simulate reward harvesting
      await crv
        .connect(josh)
        .transfer(convexFrxEthWethStrategy.address, parseUnits("10000"));

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // prettier-ignore
      await oethHarvester
          .connect(josh)["harvestAndSwap(address)"](convexFrxEthWethStrategy.address);

      const wethDiff = (await weth.balanceOf(oethDripper.address)).sub(
        wethBefore
      );
      await oethVault.connect(josh).rebase();

      await expect(wethDiff).to.be.gte(parseUnits("0.2"));
    });
    it("Only Governor can approve all tokens", async () => {
      const {
        timelock,
        strategist,
        josh,
        oethVaultSigner,
        convexFrxEthWethStrategy,
        frxETH,
        weth,
        curveFrxEthWethPool,
      } = fixture;

      // Governor can approve all tokens
      const tx = await convexFrxEthWethStrategy
        .connect(timelock)
        .safeApproveAllTokens();
      await expect(tx).to.emit(weth, "Approval");
      await expect(tx).to.emit(frxETH, "Approval");
      await expect(tx).to.emit(curveFrxEthWethPool, "Approval");

      for (const signer of [strategist, josh, oethVaultSigner]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .safeApproveAllTokens();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("with some WETH in the vault", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture, {
      wethMintAmount: 5000,
      depositToStrategy: false,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should deposit some WETH to strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        oeth,
        curveFrxEthWethPool,
        oethVault,
        oethVaultSigner,
        weth,
      } = fixture;

      const wethDepositAmount = await units("5000", weth);

      const oethSupplyBefore = await oeth.totalSupply();
      const curveBalancesBefore = await curveFrxEthWethPool.get_balances();

      log(
        `Vault weth balance ${formatUnits(
          await weth.balanceOf(oethVault.address)
        )}`
      );

      // Vault transfers WETH to strategy
      await weth
        .connect(oethVaultSigner)
        .transfer(convexFrxEthWethStrategy.address, wethDepositAmount);

      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .deposit(weth.address, wethDepositAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Deposit")
        .withArgs(weth.address, curveFrxEthWethPool.address, wethDepositAmount);

      // Check the WETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].add(wethDepositAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1],
        0.01
      );

      // Check the OETH total supply has not increased
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(oethSupplyBefore, 0.01);
    });
    it("Only vault can deposit to strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;

      const depositAmount = parseUnits("50");
      await weth
        .connect(oethVaultSigner)
        .transfer(convexFrxEthWethStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .deposit(weth.address, depositAmount);

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault can deposit all WETH to strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        curveFrxEthWethPool,
        oethVaultSigner,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;

      const depositAmount = parseUnits("50");
      await weth
        .connect(oethVaultSigner)
        .transfer(convexFrxEthWethStrategy.address, depositAmount);

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy.connect(signer).depositAll();

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .depositAll();
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Deposit")
        .withNamedArgs({
          _asset: weth.address,
          _pToken: curveFrxEthWethPool.address,
        });
    });
  });

  describe("with WETH in the Curve pool", () => {
    const loadFixture = createFixtureLoader(convexFrxEthFixture, {
      wethMintAmount: 5000,
      depositToStrategy: true,
    });
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Vault should be able to withdraw all", async () => {
      const {
        convexFrxEthWethStrategy,
        curveFrxEthWethPool,
        oeth,
        oethVaultSigner,
        frxETH,
        weth,
      } = fixture;

      const oethSupplyBefore = await oeth.totalSupply();

      const {
        wethWithdrawAmount,
        frxEthWithdrawAmount,
        curveBalances: curveBalancesBefore,
      } = await calcWithdrawAllAmounts(fixture);

      // Now try to withdraw all the WETH and frxETH from the strategy
      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .withdrawAll();

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
        .withArgs(
          weth.address,
          curveFrxEthWethPool.address,
          wethWithdrawAmount
        );
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
        .withArgs(
          frxETH.address,
          curveFrxEthWethPool.address,
          frxEthWithdrawAmount
        );

      // Check the WETH and frxETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(wethWithdrawAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1].sub(frxEthWithdrawAmount),
        0.01 // 0.01%
      );

      // Check the OETH total supply did not decrease
      expect(await oeth.totalSupply()).to.approxEqualTolerance(
        oethSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );
    });
    it("Vault should be able to withdraw some WETH", async () => {
      const {
        convexFrxEthWethStrategy,
        oeth,
        curveFrxEthWethPool,
        oethVault,
        oethVaultSigner,
        weth,
      } = fixture;

      const wethWithdrawAmount = oethUnits("1000");

      const curveBalancesBefore = await curveFrxEthWethPool.get_balances();
      const oethSupplyBefore = await oeth.totalSupply();
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      // Now try to withdraw the WETH from the strategy
      const tx = await convexFrxEthWethStrategy
        .connect(oethVaultSigner)
        .withdraw(oethVault.address, weth.address, wethWithdrawAmount);

      // Check emitted events
      await expect(tx)
        .to.emit(convexFrxEthWethStrategy, "Withdrawal")
        .withArgs(
          weth.address,
          curveFrxEthWethPool.address,
          wethWithdrawAmount
        );

      // Check the WETH and frxETH balances in the Curve pool
      const curveBalancesAfter = await curveFrxEthWethPool.get_balances();
      expect(curveBalancesAfter[0]).to.approxEqualTolerance(
        curveBalancesBefore[0].sub(wethWithdrawAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(curveBalancesAfter[1]).to.approxEqualTolerance(
        curveBalancesBefore[1],
        0.01 // 0.01%
      );

      // Check the OETH total supply hasn't changed much
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore,
        0.01 // 0.01% or 1 basis point
      );

      // Check the WETH balance in the Vault
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(wethWithdrawAmount)
      );
    });
    it("Only vault can withdraw some WETH from the strategy", async function () {
      const {
        convexFrxEthWethStrategy,
        oethVault,
        strategist,
        timelock,
        josh,
        weth,
      } = fixture;

      for (const signer of [strategist, timelock, josh]) {
        const tx = convexFrxEthWethStrategy
          .connect(signer)
          .withdraw(oethVault.address, weth.address, parseUnits("50"));

        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
    });
    it("Only vault and governor can withdraw all WETH from the strategy", async function () {
      const { convexFrxEthWethStrategy, strategist, timelock, josh } = fixture;

      for (const signer of [strategist, josh]) {
        const tx = convexFrxEthWethStrategy.connect(signer).withdrawAll();

        await expect(tx).to.revertedWith("Caller is not the Vault or Governor");
      }

      // Governor can withdraw all
      const tx = convexFrxEthWethStrategy.connect(timelock).withdrawAll();
      await expect(tx).to.emit(convexFrxEthWethStrategy, "Withdrawal");
    });
  });
});

// Calculate the WETH and frxETH amounts from a withdrawAll
async function calcWithdrawAllAmounts(fixture) {
  const {
    convexFrxEthWethStrategy,
    cvxFrxEthWethRewardPool,
    curveFrxEthWethPool,
  } = fixture;

  // Get the ETH and OETH balances in the Curve Metapool
  const curveBalances = await curveFrxEthWethPool.get_balances();
  const strategyLpAmount = await cvxFrxEthWethRewardPool.balanceOf(
    convexFrxEthWethStrategy.address
  );
  const totalLpSupply = await curveFrxEthWethPool.totalSupply();

  // WETH to withdraw = WETH pool balance * strategy LP amount / total pool LP amount
  const wethWithdrawAmount = curveBalances[0]
    .mul(strategyLpAmount)
    .div(totalLpSupply);
  // frxETH to burn = frxETH pool balance * strategy LP amount / total pool LP amount
  const frxEthWithdrawAmount = curveBalances[1]
    .mul(strategyLpAmount)
    .div(totalLpSupply);

  log(`WETH withdraw amount : ${formatUnits(wethWithdrawAmount)}`);
  log(`ETH withdraw amount  : ${formatUnits(frxEthWithdrawAmount)}`);

  return { wethWithdrawAmount, frxEthWithdrawAmount, curveBalances };
}
