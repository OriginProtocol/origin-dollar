const { expect } = require("chai");
const { formatUnits } = require("ethers").utils;
const { BigNumber } = require("ethers");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const addresses = require("../../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../../utils/constants");
const { units, oethUnits, isCI } = require("../helpers");
const { balancerREthFixture, createFixtureLoader } = require("../_fixture");

const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");

const log = require("../../utils/logger")("test:fork:strategy:balancer");

const loadBalancerREthFixtureDefault = createFixtureLoader(
  balancerREthFixture,
  {
    defaultStrategy: true,
  }
);

const loadBalancerREthFixtureNotDefault = createFixtureLoader(
  balancerREthFixture,
  {
    defaultStrategy: false,
  }
);

describe("ForkTest: Balancer MetaStablePool rETH/WETH Strategy", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("Post deployment", () => {
    beforeEach(async () => {
      fixture = await loadBalancerREthFixtureDefault();
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

      // Check deviation values
      expect(await balancerREthStrategy.maxDepositDeviation()).to.equal(
        oethUnits("0.01")
      );
      expect(await balancerREthStrategy.maxWithdrawalDeviation()).to.equal(
        oethUnits("0.01")
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

    it("Should safeApproveAllTokens", async function () {
      const { reth, rEthBPT, weth, balancerREthStrategy, timelock } = fixture;
      const balancerVault = await balancerREthStrategy.balancerVault();
      const auraRewardPool = await balancerREthStrategy.auraRewardPoolAddress();

      const MAX = BigNumber.from(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      const ZERO = BigNumber.from(0);
      const expectAllowanceRaw = async (expected, asset, owner, spender) => {
        const allowance = await asset.allowance(owner, spender);
        await expect(allowance).to.eq(expected);
      };

      const resetAllowance = async (asset, spender) => {
        // strategy needs some ETH so it can execute the transactions
        const strategySigner = await impersonateAndFund(
          balancerREthStrategy.address,
          "10"
        );
        await asset.connect(strategySigner).approve(spender, ZERO);
      };

      await resetAllowance(reth, balancerVault);
      await resetAllowance(weth, balancerVault);
      await resetAllowance(rEthBPT, balancerVault);
      await resetAllowance(rEthBPT, auraRewardPool);

      await expectAllowanceRaw(
        ZERO,
        reth,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        ZERO,
        weth,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        ZERO,
        rEthBPT,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        ZERO,
        rEthBPT,
        balancerREthStrategy.address,
        auraRewardPool
      );

      await balancerREthStrategy.connect(timelock).safeApproveAllTokens();

      await expectAllowanceRaw(
        MAX,
        reth,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        MAX,
        weth,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        MAX,
        rEthBPT,
        balancerREthStrategy.address,
        balancerVault
      );
      await expectAllowanceRaw(
        MAX,
        rEthBPT,
        balancerREthStrategy.address,
        auraRewardPool
      );
    });
  });

  describe("Deposit", function () {
    beforeEach(async () => {
      fixture = await loadBalancerREthFixtureNotDefault();
      const { oethVault, josh, reth } = fixture;

      await reth.connect(josh).transfer(oethVault.address, oethUnits("32"));
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

      const oethVaultSigner = await impersonateAndFund(oethVault.address);

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
      const strategyValueAfter = await balancerREthStrategy["checkBalance()"]();

      expect(rethInVaultBefore.sub(rethInVaultAfter)).to.equal(rethUnits);
      expect(wethInVaultBefore.sub(wethInVaultAfter)).to.equal(wethUnits);
      expect(
        strategyValueAfter.sub(strategyValueBefore)
        /* can in theory be up to ~2% off when calculating rETH value since the
         * chainlink oracle allows for 2% deviation: https://data.chain.link/ethereum/mainnet/crypto-eth/reth-eth
         *
         * Since we are also depositing WETH that 2% deviation should be diluted to
         * roughly ~1% when pricing value in the strategy. We are choosing 0.5% here for now
         * and will adjust to more if needed.
         */
      ).to.approxEqualTolerance(rethValue.add(wethUnits), 2);
    });

    it("Should be able to deposit with higher deposit deviation", async function () {});

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

    it("Should not return invalid balance of unsupported asset", async () => {
      // Deposit something
      const { reth, rEthBPT, weth, balancerREthStrategy, frxETH, stETH } =
        fixture;
      await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);

      // Check balance
      for (const unsupportedAsset of [frxETH, stETH]) {
        await expect(
          balancerREthStrategy["checkBalance(address)"](
            unsupportedAsset.address
          )
        ).to.be.revertedWith("Unsupported asset");
      }
    });
  });

  describe("Withdraw", function () {
    beforeEach(async () => {
      fixture = await loadBalancerREthFixtureNotDefault();
      const { balancerREthStrategy, oethVault, josh, strategist, reth, weth } =
        fixture;

      await reth.connect(josh).transfer(oethVault.address, oethUnits("32"));

      await oethVault
        .connect(strategist)
        .depositToStrategy(
          balancerREthStrategy.address,
          [weth.address, reth.address],
          [oethUnits("32"), oethUnits("32")]
        );
    });

    // a list of WETH/RETH pairs
    const withdrawalTestCases = [
      ["10", "0"],
      ["0", "8"],
      ["11", "14"],
      ["2.9543", "9.234"],
      ["1.0001", "0"],
      ["9.99998", "0"],
      ["0", "7.00123"],
      ["0", "0.210002"],
      ["38.432", "12.5643"],
      ["5.123452", "29.00123"],
      ["22.1232", "30.12342"],
    ];

    for (const [wethAmount, rethAmount] of withdrawalTestCases) {
      it(`Should be able to withdraw ${wethAmount} WETH and ${rethAmount} RETH from the pool`, async function () {
        const { reth, balancerREthStrategy, oethVault, weth } = fixture;

        const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);
        const vaultRethBalanceBefore = await reth.balanceOf(oethVault.address);
        const wethWithdrawAmount = await units(wethAmount, weth);
        const rethWithdrawAmount = await units(rethAmount, reth);

        const oethVaultSigner = await impersonateAndFund(oethVault.address);

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
    }

    it("Should be able to withdraw all of pool liquidity", async function () {
      const { oethVault, weth, reth, balancerREthStrategy } = fixture;

      const wethBalanceBefore = await balancerREthStrategy[
        "checkBalance(address)"
      ](weth.address);
      const stEthBalanceBefore = await balancerREthStrategy[
        "checkBalance(address)"
      ](reth.address);

      const oethVaultSigner = await impersonateAndFund(oethVault.address);

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

    it("Should be able to withdraw with higher withdrawal deviation", async function () {});
  });

  // Minting with rETH is unsupported
  describe.skip("Large withdraw", function () {
    const depositAmount = 30000;
    let depositAmountUnits, oethVaultSigner;
    beforeEach(async () => {
      fixture = await loadBalancerREthFixtureNotDefault();
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

      oethVaultSigner = await impersonateAndFund(oethVault.address);

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
      const { auraPool, balancerREthStrategy, rEthBPT, oethVault, reth, weth } =
        fixture;

      const withdrawAmount = 29690;
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
      const { balancerREthStrategy, rEthBPT, oethVault, reth, weth, auraPool } =
        fixture;

      const stratValueBefore = await oethVault.totalValue();
      log(`Vault total value before: ${formatUnits(stratValueBefore)}`);

      const bptBefore = await auraPool.balanceOf(balancerREthStrategy.address);
      log(`Aura BPTs before: ${formatUnits(bptBefore)}`);

      const withdrawAmount = 29700;
      const withdrawAmountUnits = oethUnits(withdrawAmount.toString(), 18);

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
      fixture = await loadBalancerREthFixtureDefault();

      const { oethVault, josh, reth } = fixture;

      await reth.connect(josh).transfer(oethVault.address, oethUnits("32"));
    });
    it("Should be able to collect reward tokens", async function () {
      const {
        weth,
        reth,
        rEthBPT,
        balancerREthStrategy,
        oethHarvester,
        bal,
        aura,
      } = fixture;

      const sHarvester = await impersonateAndFund(oethHarvester.address);
      const balBefore = await bal.balanceOf(oethHarvester.address);
      const auraBefore = await aura.balanceOf(oethHarvester.address);

      await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);
      await mine(1000);

      await balancerREthStrategy.connect(sHarvester).collectRewardTokens();

      expect(await bal.balanceOf(oethHarvester.address)).to.be.gt(
        balBefore.add(oethUnits("0.1"))
      );
      expect(await aura.balanceOf(oethHarvester.address)).to.be.gt(
        auraBefore.add(oethUnits("0.1"))
      );
    });

    it("Should be able to collect and swap reward tokens", async function () {
      const {
        josh,
        balancerREthStrategy,
        weth,
        reth,
        oethHarvester,
        rEthBPT,
        oethDripper,
        bal,
        aura,
      } = fixture;

      // Deposite some LP to the pool so that we can harvest some tokens
      await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);
      await mine(1000);

      // Let the strategy have some tokens it can send to Harvester
      await setERC20TokenBalance(
        balancerREthStrategy.address,
        bal,
        oethUnits("50")
      );
      await setERC20TokenBalance(
        balancerREthStrategy.address,
        aura,
        oethUnits("50")
      );

      const wethBalanceBefore = await weth.balanceOf(oethDripper.address);
      await oethHarvester.connect(josh)[
        // eslint-disable-next-line
        "harvestAndSwap(address)"
      ](balancerREthStrategy.address);

      const wethBalanceDiff = (await weth.balanceOf(oethDripper.address)).sub(
        wethBalanceBefore
      );

      expect(wethBalanceDiff).to.be.gt(oethUnits("0"));
    });
  });
});

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

async function depositTest(
  fixture,
  amounts,
  allAssets,
  bpt,
  strategyValueDiffPct = 3
) {
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
  expect(strategyValuesDiff).to.approxEqualTolerance(
    sumEthAmounts,
    strategyValueDiffPct
  );
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
  strategy,
  allAssets,
  reth,
}) {
  const oethSupply = await oeth.totalSupply();
  const bptSupply = await bpt.totalSupply();

  log(`\nOETH total supply: ${formatUnits(oethSupply)}`);
  log(`BPT total supply : ${formatUnits(bptSupply)}`);

  const vaultAssets = {};
  for (const asset of allAssets) {
    const vaultAssetAmount = await asset.balanceOf(oethVault.address);
    const symbol = await asset.symbol();
    log(`${symbol} in vault ${formatUnits(vaultAssetAmount)}`);
    vaultAssets[symbol] = vaultAssetAmount;
  }

  const strategyValues = await getPoolValues(strategy, allAssets, reth);

  const poolBalances = await getPoolBalances(balancerVault, pid);

  return {
    oethSupply,
    bptSupply,
    strategyValues,
    poolBalances,
    vaultAssets,
  };
}
