const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const { loadFixture } = require("ethereum-waffle");

const addresses = require("../../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const {
  balancerREthFixture,
  impersonateAndFundContract,
} = require("../_fixture");

const log = require("../../utils/logger")("test:fork:strategy:balancer");

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool rETH/WETH Strategy",
  function () {
    this.timeout(0);
    // due to hardhat forked mode timeouts - retry failed tests up to 3 times
    // this.retries(3);

    let fixture;
    beforeEach(async () => {
      fixture = await loadFixture(balancerREthFixture);
    });

    describe("Post deployment", () => {
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
        const { timelock, reth, weth, oethVault } = fixture;
        await oethVault
          .connect(timelock)
          .setAssetDefaultStrategy(reth.address, addresses.zero);
        await oethVault
          .connect(timelock)
          .setAssetDefaultStrategy(weth.address, addresses.zero);
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

    describe("Harvest rewards", function () {
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
    balancerREthStrategy,
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

async function logBalances({
  oeth,
  oethVault,
  bpt,
  balancerVault,
  pid,
  balancerREthStrategy,
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

  const strategyValues = await getPoolValues(
    balancerREthStrategy,
    allAssets,
    reth
  );

  const poolBalances = await getPoolBalances(balancerVault, pid);

  return {
    oethSupply,
    bptSupply,
    strategyValues,
    poolBalances,
  };
}
