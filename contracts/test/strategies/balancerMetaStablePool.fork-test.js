const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers").utils;
const { BigNumber } = require("ethers");

const addresses = require("../../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  balancerREthFixtureSetup,
  balancerWstEthFixtureSetup,
  impersonateAndFundContract,
  defaultFixtureSetup,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:strategy:balancer");

const balancerREthFixture = balancerREthFixtureSetup({
  defaultStrategy: true,
});
const noDefaultBalancerREthFixture = balancerREthFixtureSetup({
  defaultStrategy: false,
});
const balancerWstEthFixture = balancerWstEthFixtureSetup();

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool rETH/WETH Strategy",
  function () {
    this.timeout(0);
    // due to hardhat forked mode timeouts - retry failed tests up to 3 times
    // this.retries(3);

    let fixture;

    after(async () => {
      // This is needed to revert fixtures
      // The other tests as of now don't use proper fixtures
      // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
      const f = defaultFixtureSetup();
      await f();
    });

    describe("Post deployment", () => {
      beforeEach(async () => {
        fixture = await balancerREthFixture();
      });
      it("Should have the correct initial state", async function () {
        const { balancerREthStrategy, oethVault } = fixture;

        // Platform and OToken Vault
        expect(await balancerREthStrategy.platformAddress()).to.equal(
          addresses.mainnet.rETH_WETH_BPT
        );
        expect(await balancerREthStrategy.vaultAddress()).to.equal(
          oethVault.address
        );

        // Balancer and Aura config
        expect(await balancerREthStrategy.balancerVault()).to.equal(
          addresses.mainnet.balancerVault
        );
        expect(await balancerREthStrategy.balancerPoolId()).to.equal(
          balancer_rETH_WETH_PID
        );
        expect(await balancerREthStrategy.auraRewardPoolAddress()).to.equal(
          addresses.mainnet.rETH_WETH_AuraRewards
        );

        // Check slippage values
        expect(await balancerREthStrategy.maxDepositSlippage()).to.equal(
          oethUnits("0.001")
        );
        expect(await balancerREthStrategy.maxWithdrawalSlippage()).to.equal(
          oethUnits("0.001")
        );
        // Check addresses
        expect(await balancerREthStrategy.rETH()).to.equal(
          addresses.mainnet.rETH
        );
        expect(await balancerREthStrategy.wstETH()).to.equal(
          addresses.mainnet.wstETH
        );
        expect(await balancerREthStrategy.stETH()).to.equal(
          addresses.mainnet.stETH
        );
        expect(await balancerREthStrategy.sfrxETH()).to.equal(
          addresses.mainnet.sfrxETH
        );
        expect(await balancerREthStrategy.frxETH()).to.equal(
          addresses.mainnet.frxETH
        );
      });
    });

    describe("Deposit", function () {
      beforeEach(async () => {
        fixture = await noDefaultBalancerREthFixture();
      });
      it("Should deposit 5 WETH and 5 rETH in Balancer MetaStablePool strategy", async function () {
        const { reth, rEthBPT, weth } = fixture;
        await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);
      });
      it("Should deposit 12 WETH in Balancer MetaStablePool strategy", async function () {
        const { reth, rEthBPT, weth } = fixture;
        await depositTest(fixture, [12, 0], [weth, reth], rEthBPT);
      });
      it("Should deposit 30 rETH in Balancer MetaStablePool strategy", async function () {
        const { reth, rEthBPT, weth } = fixture;
        await depositTest(fixture, [0, 30], [weth, reth], rEthBPT);
      });
      it("Should deposit all WETH and rETH in strategy to pool", async function () {
        const { balancerREthStrategy, oethVault, reth, weth } = fixture;

        const rethInVaultBefore = await reth.balanceOf(oethVault.address);
        const wethInVaultBefore = await weth.balanceOf(oethVault.address);
        const strategyValueBefore = await balancerREthStrategy[
          "checkBalance()"
        ]();

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        const rethUnits = oethUnits("7");
        const rethValue = await reth.getEthValue(rethUnits);
        await reth
          .connect(oethVaultSigner)
          .transfer(balancerREthStrategy.address, rethUnits);
        const wethUnits = oethUnits("8");
        await weth
          .connect(oethVaultSigner)
          .transfer(balancerREthStrategy.address, wethUnits);

        await balancerREthStrategy.connect(oethVaultSigner).depositAll();

        const rethInVaultAfter = await reth.balanceOf(oethVault.address);
        const wethInVaultAfter = await weth.balanceOf(oethVault.address);
        const strategyValueAfter = await balancerREthStrategy[
          "checkBalance()"
        ]();

        expect(rethInVaultBefore.sub(rethInVaultAfter)).to.equal(rethUnits);
        expect(wethInVaultBefore.sub(wethInVaultAfter)).to.equal(wethUnits);
        expect(
          strategyValueAfter.sub(strategyValueBefore)
        ).to.approxEqualTolerance(rethValue.add(wethUnits), 0.01);
      });

      it("Should be able to deposit with higher deposit slippage", async function () {});

      it("Should revert when read-only re-entrancy is triggered", async function () {
        /* - needs to be an asset default strategy
         * - needs pool that supports native ETH
         * - attacker needs to try to deposit to Balancer pool and withdraw
         * - while withdrawing and receiving ETH attacker should take over the execution flow
         *   and try calling mint/redeem with the strategy default asset on the OethVault
         * - transaction should revert because of the `whenNotInVaultContext` modifier
         */
      });

      it("Should check balance for gas usage", async () => {
        const { balancerREthStrategy, josh, weth } = fixture;

        // Check balance in a transaction so the gas usage can be measured
        await balancerREthStrategy["checkBalance(address)"](weth.address);
        const tx = await balancerREthStrategy
          .connect(josh)
          .populateTransaction["checkBalance(address)"](weth.address);
        await josh.sendTransaction(tx);
      });
    });

    describe("Withdraw", function () {
      beforeEach(async () => {
        fixture = await noDefaultBalancerREthFixture();
        const { balancerREthStrategy, oethVault, strategist, reth, weth } =
          fixture;

        await oethVault
          .connect(strategist)
          .depositToStrategy(
            balancerREthStrategy.address,
            [weth.address, reth.address],
            [oethUnits("22"), oethUnits("25")]
          );
      });
      it("Should be able to withdraw 10 WETH from the pool", async function () {
        const { weth, balancerREthStrategy, oethVault } = fixture;

        const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
        const withdrawAmount = await units("10", weth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            weth.address,
            withdrawAmount
          );

        const vaultWethBalanceAfter = await weth.balanceOf(oethVault.address);
        const wethBalanceDiffVault = vaultWethBalanceAfter.sub(
          vaultWethBalanceBefore
        );
        expect(wethBalanceDiffVault).to.approxEqualTolerance(
          withdrawAmount,
          0.01
        );
      });
      it("Should be able to withdraw 8 RETH from the pool", async function () {
        const { reth, balancerREthStrategy, oethVault } = fixture;

        const vaultRethBalanceBefore = await reth.balanceOf(oethVault.address);
        const withdrawAmount = await units("8", reth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            reth.address,
            withdrawAmount
          );

        const vaultRethBalanceAfter = await reth.balanceOf(oethVault.address);
        const rethBalanceDiffVault = vaultRethBalanceAfter.sub(
          vaultRethBalanceBefore
        );
        expect(rethBalanceDiffVault).to.approxEqualTolerance(
          withdrawAmount,
          0.01
        );
      });
      it("Should be able to withdraw 11 WETH and 14 RETH from the pool", async function () {
        const { reth, balancerREthStrategy, oethVault, weth } = fixture;

        const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
        const vaultRethBalanceBefore = await reth.balanceOf(oethVault.address);
        const wethWithdrawAmount = await units("11", weth);
        const rethWithdrawAmount = await units("14", reth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address[],uint256[])"](
            oethVault.address,
            [weth.address, reth.address],
            [wethWithdrawAmount, rethWithdrawAmount]
          );

        expect(
          (await weth.balanceOf(oethVault.address)).sub(vaultWethBalanceBefore)
        ).to.approxEqualTolerance(wethWithdrawAmount, 0.01);
        expect(
          (await reth.balanceOf(oethVault.address)).sub(vaultRethBalanceBefore)
        ).to.approxEqualTolerance(rethWithdrawAmount, 0.01);
      });

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { oethVault, weth, reth, balancerREthStrategy } = fixture;

        const wethBalanceBefore = await balancerREthStrategy[
          "checkBalance(address)"
        ](weth.address);
        const stEthBalanceBefore = await balancerREthStrategy[
          "checkBalance(address)"
        ](reth.address);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerREthStrategy.connect(oethVaultSigner).withdrawAll();

        const wethBalanceDiff = wethBalanceBefore.sub(
          await balancerREthStrategy["checkBalance(address)"](weth.address)
        );
        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerREthStrategy["checkBalance(address)"](reth.address)
        );

        expect(wethBalanceDiff).to.be.gte(await units("15", weth), 1);
        expect(stEthBalanceDiff).to.be.gte(await units("15", reth), 1);
      });

      it("Should be able to withdraw with higher withdrawal slippage", async function () {});
    });

    describe("Large withdraw", function () {
      const depositAmount = 30000;
      let depositAmountUnits, oethVaultSigner;
      beforeEach(async () => {
        fixture = await noDefaultBalancerREthFixture();
        const {
          balancerREthStrategy,
          balancerREthPID,
          balancerVault,
          josh,
          oethVault,
          oethZapper,
          strategist,
          reth,
          weth,
        } = fixture;

        oethVaultSigner = await impersonateAndFundContract(oethVault.address);

        await getPoolBalances(balancerVault, balancerREthPID);

        // Mint 100k oETH using WETH
        depositAmountUnits = oethUnits(depositAmount.toString());
        await oethZapper.connect(josh).deposit({ value: depositAmountUnits });

        // Mint 100k of oETH using RETH
        await reth.connect(josh).approve(oethVault.address, depositAmountUnits);
        await oethVault.connect(josh).mint(reth.address, depositAmountUnits, 0);

        await oethVault
          .connect(strategist)
          .depositToStrategy(
            balancerREthStrategy.address,
            [weth.address, reth.address],
            [depositAmountUnits, depositAmountUnits]
          );

        log(
          `Vault deposited ${depositAmount} WETH and ${depositAmount} RETH to Balancer strategy`
        );
      });
      it(`withdraw all ${depositAmount} of both assets together using withdrawAll`, async () => {
        const { balancerREthStrategy, oethVault } = fixture;

        const stratValueBefore = await oethVault.totalValue();
        log(`Vault total value before: ${formatUnits(stratValueBefore)}`);

        // Withdraw all
        await balancerREthStrategy.connect(oethVaultSigner).withdrawAll();
        log(`Vault withdraws all WETH and RETH`);

        const stratValueAfter = await oethVault.totalValue();
        log(`Vault total value after: ${formatUnits(stratValueAfter)}`);

        const diff = stratValueBefore.sub(stratValueAfter);
        const baseUnits = depositAmountUnits.mul(2);
        const diffPercent = diff.mul(100000000).div(baseUnits);
        log(
          `Vault's ETH value change: ${formatUnits(diff)} ETH ${formatUnits(
            diffPercent,
            6
          )}%`
        );
      });
      it(`withdraw close to ${depositAmount} of both assets using multi asset withdraw`, async () => {
        const {
          auraPool,
          balancerREthStrategy,
          rEthBPT,
          oethVault,
          reth,
          weth,
        } = fixture;

        const withdrawAmount = 29950;
        const withdrawAmountUnits = oethUnits(withdrawAmount.toString(), 18);

        const stratValueBefore = await oethVault.totalValue();
        log(`Vault total value before: ${formatUnits(stratValueBefore)}`);

        // Withdraw all
        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address[],uint256[])"](
            oethVault.address,
            [weth.address, reth.address],
            [withdrawAmountUnits, withdrawAmountUnits]
          );
        log(
          `Vault withdraws ${withdrawAmount} WETH and ${withdrawAmount} RETH together`
        );

        const bptAfterReth = await auraPool.balanceOf(
          balancerREthStrategy.address
        );
        log(`Aura BPTs after withdraw: ${formatUnits(bptAfterReth)}`);
        log(
          `Strategy BPTs after withdraw: ${formatUnits(
            await rEthBPT.balanceOf(balancerREthStrategy.address)
          )}`
        );

        const stratValueAfter = await oethVault.totalValue();
        log(`Vault total value after: ${formatUnits(stratValueAfter)}`);

        const diff = stratValueBefore.sub(stratValueAfter);
        const baseUnits = withdrawAmountUnits.mul(2);
        const diffPercent = diff.mul(100000000).div(baseUnits);
        log(
          `Vault's ETH value change: ${formatUnits(diff)} ETH ${formatUnits(
            diffPercent,
            6
          )}%`
        );
      });
      it(`withdraw ${depositAmount} of each asset in separate calls`, async () => {
        const {
          balancerREthStrategy,
          rEthBPT,
          oethVault,
          timelock,
          reth,
          weth,
          auraPool,
        } = fixture;

        const stratValueBefore = await oethVault.totalValue();
        log(`Vault total value before: ${formatUnits(stratValueBefore)}`);

        const bptBefore = await auraPool.balanceOf(
          balancerREthStrategy.address
        );
        log(`Aura BPTs before: ${formatUnits(bptBefore)}`);

        const withdrawAmount = 29800;
        const withdrawAmountUnits = oethUnits(withdrawAmount.toString(), 18);

        await balancerREthStrategy
          .connect(timelock)
          .setMaxWithdrawalSlippage(parseUnits("1", 16)); // 1%

        // Withdraw WETH
        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            weth.address,
            withdrawAmountUnits
          );

        log(`Vault withdraws ${withdrawAmount} WETH`);

        const stratValueAfterWeth = await oethVault.totalValue();
        log(
          `Vault total value after WETH withdraw: ${formatUnits(
            stratValueAfterWeth
          )}`
        );
        const bptAfterWeth = await auraPool.balanceOf(
          balancerREthStrategy.address
        );
        log(`Aura BPTs after WETH withdraw: ${formatUnits(bptAfterWeth)}`);
        log(
          `Strategy BPTs after WETH withdraw: ${formatUnits(
            await rEthBPT.balanceOf(balancerREthStrategy.address)
          )}`
        );

        // Withdraw RETH
        // prettier-ignore
        await balancerREthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            reth.address,
            withdrawAmountUnits
          );

        log(`Vault withdraws ${withdrawAmount} RETH`);

        const bptAfterReth = await auraPool.balanceOf(
          balancerREthStrategy.address
        );
        log(`Aura BPTs after RETH withdraw: ${formatUnits(bptAfterReth)}`);
        log(
          `Strategy BPTs after RETH withdraw: ${formatUnits(
            await rEthBPT.balanceOf(balancerREthStrategy.address)
          )}`
        );

        const stratValueAfterReth = await oethVault.totalValue();
        log(
          `Vault total value after RETH withdraw: ${formatUnits(
            stratValueAfterReth
          )}`
        );

        const diff = stratValueBefore.sub(stratValueAfterReth);
        const baseUnits = withdrawAmountUnits.mul(2);
        const diffPercent = diff.mul(100000000).div(baseUnits);
        log(
          `Vault's ETH value change: ${formatUnits(diff)} ETH ${formatUnits(
            diffPercent,
            6
          )}%`
        );
      });
    });

    describe("Harvest rewards", function () {
      beforeEach(async () => {
        fixture = await balancerREthFixture();
      });
      it("Should be able to collect reward tokens", async function () {
        const { josh, balancerREthStrategy, oethHarvester } = fixture;

        await oethHarvester.connect(josh)[
          // eslint-disable-next-line
          "harvestAndSwap(address)"
        ](balancerREthStrategy.address);
      });
    });
  }
);

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool wstETH/WETH Strategy",
  function () {
    let fixture;
    beforeEach(async () => {
      fixture = await balancerWstEthFixture();
    });

    after(async () => {
      // This is needed to revert fixtures
      // The other tests as of now don't use proper fixtures
      // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
      const f = defaultFixtureSetup();
      await f();
    });

    describe("Deposit", function () {
      beforeEach(async () => {
        const { timelock, stETH, weth, oethVault } = fixture;
        await oethVault
          .connect(timelock)
          .setAssetDefaultStrategy(stETH.address, addresses.zero);
        await oethVault
          .connect(timelock)
          .setAssetDefaultStrategy(weth.address, addresses.zero);
      });

      it("Should deposit 5 WETH and 5 stETH in Balancer MetaStablePool strategy", async function () {
        const { stETH, stEthBPT, weth } = fixture;
        await wstETHDepositTest(fixture, [5, 5], [weth, stETH], stEthBPT);
      });
      it("Should deposit 12 WETH in Balancer MetaStablePool strategy", async function () {
        const { stETH, stEthBPT, weth } = fixture;
        await wstETHDepositTest(fixture, [12, 0], [weth, stETH], stEthBPT);
      });

      it("Should deposit 30 stETH in Balancer MetaStablePool strategy", async function () {
        const { stETH, stEthBPT, weth } = fixture;
        await wstETHDepositTest(fixture, [0, 30], [weth, stETH], stEthBPT);
      });

      it("Should check balance for gas usage", async () => {
        const { balancerWstEthStrategy, josh, weth } = fixture;

        // Check balance in a transaction so the gas usage can be measured
        await balancerWstEthStrategy["checkBalance(address)"](weth.address);
        const tx = await balancerWstEthStrategy
          .connect(josh)
          .populateTransaction["checkBalance(address)"](weth.address);
        await josh.sendTransaction(tx);
      });
    });

    describe("Withdraw", function () {
      beforeEach(async () => {
        const { balancerWstEthStrategy, oethVault, strategist, stETH, weth } =
          fixture;

        await oethVault
          .connect(strategist)
          .depositToStrategy(
            balancerWstEthStrategy.address,
            [weth.address, stETH.address],
            [oethUnits("25"), oethUnits("25")]
          );

        // TODO: Check slippage errors
        await balancerWstEthStrategy
          .connect(strategist)
          .setMaxWithdrawalSlippage(oethUnits("0.01"));
      });
      it("Should be able to withdraw 10 WETH from the pool", async function () {
        const { weth, balancerWstEthStrategy, oethVault } = fixture;

        const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
        const withdrawAmount = await units("10", weth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerWstEthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            weth.address,
            withdrawAmount
          );

        const vaultWethBalanceAfter = await weth.balanceOf(oethVault.address);
        const wethBalanceDiffVault = vaultWethBalanceAfter.sub(
          vaultWethBalanceBefore
        );
        expect(wethBalanceDiffVault).to.approxEqualTolerance(withdrawAmount, 1);
      });
      it("Should be able to withdraw 8 stETH from the pool", async function () {
        const { stETH, balancerWstEthStrategy, oethVault } = fixture;

        const vaultstETHBalanceBefore = await stETH.balanceOf(
          oethVault.address
        );
        const withdrawAmount = await units("8", stETH);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerWstEthStrategy
          .connect(oethVaultSigner)["withdraw(address,address,uint256)"](
            oethVault.address,
            stETH.address,
            withdrawAmount
          );

        const vaultstETHBalanceAfter = await stETH.balanceOf(oethVault.address);
        const stETHBalanceDiffVault = vaultstETHBalanceAfter.sub(
          vaultstETHBalanceBefore
        );
        expect(stETHBalanceDiffVault).to.approxEqualTolerance(
          withdrawAmount,
          1
        );
      });
      it("Should be able to withdraw 11 WETH and 14 stETH from the pool", async function () {
        const { stETH, balancerWstEthStrategy, oethVault, weth } = fixture;

        const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
        const vaultstEthBalanceBefore = await stETH.balanceOf(
          oethVault.address
        );
        const wethWithdrawAmount = await units("11", weth);
        const stETHWithdrawAmount = await units("14", stETH);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        // prettier-ignore
        await balancerWstEthStrategy
          .connect(oethVaultSigner)["withdraw(address,address[],uint256[])"](
            oethVault.address,
            [weth.address, stETH.address],
            [wethWithdrawAmount, stETHWithdrawAmount]
          );

        expect(
          (await weth.balanceOf(oethVault.address)).sub(vaultWethBalanceBefore)
        ).to.approxEqualTolerance(wethWithdrawAmount, 1);
        expect(
          (await stETH.balanceOf(oethVault.address)).sub(
            vaultstEthBalanceBefore
          )
        ).to.approxEqualTolerance(stETHWithdrawAmount, 1);
      });

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { oethVault, weth, stETH, balancerWstEthStrategy } = fixture;

        const wethBalanceBefore = await balancerWstEthStrategy[
          "checkBalance(address)"
        ](weth.address);
        const stEthBalanceBefore = await balancerWstEthStrategy[
          "checkBalance(address)"
        ](stETH.address);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerWstEthStrategy.connect(oethVaultSigner).withdrawAll();

        const wethBalanceDiff = wethBalanceBefore.sub(
          await balancerWstEthStrategy["checkBalance(address)"](weth.address)
        );
        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerWstEthStrategy["checkBalance(address)"](stETH.address)
        );

        expect(wethBalanceDiff).to.be.gte(await units("15", weth), 1);
        expect(stEthBalanceDiff).to.be.gte(await units("15", stETH), 1);
      });
    });

    describe("Harvest rewards", function () {
      it("Should be able to collect reward tokens", async function () {
        const { josh, balancerWstEthStrategy, oethHarvester } = fixture;

        await oethHarvester.connect(josh)[
          // eslint-disable-next-line
          "harvestAndSwap(address)"
        ](balancerWstEthStrategy.address);
      });
    });
  }
);

async function getPoolValues(strategy, allAssets, reth) {
  const result = {
    sum: BigNumber.from(0),
  };

  for (const asset of allAssets) {
    const assetSymbol = await asset.symbol();
    const strategyAssetBalance = await strategy["checkBalance(address)"](
      asset.address
    );
    log(
      `Balancer ${assetSymbol} balance: ${formatUnits(strategyAssetBalance)}`
    );
    const strategyAssetValue =
      asset.address === reth.address
        ? await reth.getEthValue(strategyAssetBalance)
        : strategyAssetBalance;
    result.sum = result.sum.add(strategyAssetValue);
    log(`Balancer ${assetSymbol} value: ${formatUnits(strategyAssetValue)}`);
    result[assetSymbol] = strategyAssetBalance;
  }
  log(`Balancer sum values: ${formatUnits(result.sum)}`);

  result.value = await strategy["checkBalance()"]();
  log(`Balancer value: ${formatUnits(result.value)}`);

  return result;
}

async function getPoolBalances(balancerVault, pid) {
  const result = {};
  const { tokens, balances } = await balancerVault.getPoolTokens(pid);
  let i = 0;
  for (const balance of balances) {
    const assetAddr = tokens[i++];
    log(`${assetAddr} pool balance: ${formatUnits(balance)}`);
    result[assetAddr] = balance;
  }
  return result;
}

async function depositTest(fixture, amounts, allAssets, bpt) {
  const {
    oethVault,
    oeth,
    balancerREthStrategy,
    balancerVault,
    balancerREthPID,
    reth,
    strategist,
  } = fixture;
  const logParams = {
    oeth,
    oethVault,
    bpt,
    balancerVault,
    strategy: balancerREthStrategy,
    allAssets,
    pid: balancerREthPID,
    reth,
  };

  const unitAmounts = amounts.map((amount) => oethUnits(amount.toString()));
  const ethAmounts = await Promise.all(
    allAssets.map((asset, i) =>
      asset.address === reth.address
        ? reth.getEthValue(unitAmounts[i])
        : unitAmounts[i]
    )
  );
  const sumEthAmounts = ethAmounts.reduce(
    (a, b) => a.add(b),
    BigNumber.from(0)
  );

  const before = await logBalances(logParams);

  await oethVault.connect(strategist).depositToStrategy(
    balancerREthStrategy.address,
    allAssets.map((asset) => asset.address),
    unitAmounts
  );

  const after = await logBalances(logParams);

  // Should have liquidity in Balancer
  const strategyValuesDiff = after.strategyValues.sum.sub(
    before.strategyValues.sum
  );
  expect(strategyValuesDiff).to.approxEqualTolerance(sumEthAmounts, 0.1);
  expect(
    after.strategyValues.value,
    "strategy total value = sum of asset values"
  ).to.approxEqualTolerance(after.strategyValues.sum, 0.01);
}

async function wstETHDepositTest(fixture, amounts, allAssets, bpt) {
  const {
    oethVault,
    oeth,
    balancerWstEthStrategy,
    balancerVault,
    balancerWstEthPID,
    strategist,
    reth,
  } = fixture;
  const logParams = {
    oeth,
    oethVault,
    bpt,
    balancerVault,
    strategy: balancerWstEthStrategy,
    allAssets,
    pid: balancerWstEthPID,
    reth,
  };

  const unitAmounts = amounts.map((amount) => oethUnits(amount.toString()));
  const ethAmounts = unitAmounts;
  const sumEthAmounts = ethAmounts.reduce(
    (a, b) => a.add(b),
    BigNumber.from(0)
  );

  const before = await logBalances(logParams);

  await oethVault.connect(strategist).depositToStrategy(
    balancerWstEthStrategy.address,
    allAssets.map((asset) => asset.address),
    unitAmounts
  );

  const after = await logBalances(logParams);

  // Should have liquidity in Balancer
  const strategyValuesDiff = after.strategyValues.sum.sub(
    before.strategyValues.sum
  );
  expect(strategyValuesDiff).to.approxEqualTolerance(sumEthAmounts, 1);
  expect(
    after.strategyValues.value,
    "strategy total value = sum of asset values"
  ).to.approxEqualTolerance(after.strategyValues.sum, 1);
}

async function logBalances({
  oeth,
  oethVault,
  bpt,
  balancerVault,
  pid,
  strategy,
  allAssets,
  reth,
}) {
  const oethSupply = await oeth.totalSupply();
  const bptSupply = await bpt.totalSupply();

  log(`\nOETH total supply: ${formatUnits(oethSupply)}`);
  log(`BPT total supply : ${formatUnits(bptSupply)}`);

  for (const asset of allAssets) {
    const vaultAssets = await asset.balanceOf(oethVault.address);
    log(`${await asset.symbol()} in vault ${formatUnits(vaultAssets)}`);
  }

  const strategyValues = await getPoolValues(strategy, allAssets, reth);

  const poolBalances = await getPoolBalances(balancerVault, pid);

  return {
    oethSupply,
    bptSupply,
    strategyValues,
    poolBalances,
  };
}
