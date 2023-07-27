const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const { loadFixture } = require("ethereum-waffle");

const addresses = require("../../utils/addresses");
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
        const { balancerREthStrategy } = fixture;

        expect(await balancerREthStrategy.maxDepositSlippage()).to.equal(
          oethUnits("0.001")
        );
        expect(await balancerREthStrategy.maxWithdrawalSlippage()).to.equal(
          oethUnits("0.001")
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
      it("Should deposit 12 WETH in Balancer MetaStablePool strategy", async function () {
        const { reth, rEthBPT, weth } = fixture;
        await depositTest(fixture, weth, "12", [weth, reth], rEthBPT);
      });

      it("Should deposit 30 rETH in Balancer MetaStablePool strategy", async function () {
        const { reth, rEthBPT, weth } = fixture;
        await depositTest(fixture, reth, "30", [weth, reth], rEthBPT);
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
        await balancerREthStrategy.checkBalance(weth.address);
        const tx = await balancerREthStrategy
          .connect(josh)
          .populateTransaction.checkBalance(weth.address);
        await josh.sendTransaction(tx);
      });
    });

    describe("Withdraw", function () {
      it("Should be able to withdraw some amount of pool liquidity", async function () {
        const { weth, balancerREthStrategy, oethVault } = fixture;
        // await mintTest(fixture, josh, weth, "30", [weth, reth], rEthBPT);

        const wethBalanceBeforeVault = await weth.balanceOf(oethVault.address);
        const wethToWithdraw = await units("10", weth);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerREthStrategy
          .connect(oethVaultSigner)
          .withdraw(oethVault.address, weth.address, wethToWithdraw);

        const wethBalanceDiffVault = (
          await weth.balanceOf(oethVault.address)
        ).sub(wethBalanceBeforeVault);
        expect(wethBalanceDiffVault).to.approxEqualTolerance(wethToWithdraw, 1);
      });

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { oethVault, weth, reth, balancerREthStrategy } = fixture;

        const wethBalanceBefore = await balancerREthStrategy.checkBalance(
          weth.address
        );
        const stEthBalanceBefore = await balancerREthStrategy.checkBalance(
          reth.address
        );

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerREthStrategy.connect(oethVaultSigner).withdrawAll();

        const wethBalanceDiff = wethBalanceBefore.sub(
          await balancerREthStrategy.checkBalance(weth.address)
        );
        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerREthStrategy.checkBalance(reth.address)
        );

        expect(wethBalanceDiff).to.be.gte(await units("15", weth), 1);
        expect(stEthBalanceDiff).to.be.gte(await units("15", reth), 1);
      });

      it("Should have the correct initial maxWithdrawalSlippage state", async function () {
        const { balancerREthStrategy, josh } = fixture;
        expect(
          await balancerREthStrategy.connect(josh).maxWithdrawalSlippage()
        ).to.equal(oethUnits("0.001"));
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

async function getPoolValues(strategy, allAssets) {
  const result = {
    total: BigNumber.from(0),
  };

  for (const asset of allAssets) {
    const assetSymbol = await asset.symbol();
    const strategyAssetValue = await strategy.checkBalance(asset.address);
    result.total = result.total.add(strategyAssetValue);
    log(`Balancer ${assetSymbol} value: ${formatUnits(strategyAssetValue)}`);
    result[assetSymbol] = strategyAssetValue;
  }
  log(`Balancer total value: ${formatUnits(result.total)}`);

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

async function depositTest(fixture, asset, amount, allAssets, bpt) {
  const {
    oethVault,
    oeth,
    balancerREthStrategy,
    balancerVault,
    balancerREthPID,
    reth,
    strategist,
    weth,
  } = fixture;
  const logParams = {
    oeth,
    oethVault,
    asset,
    bpt,
    balancerVault,
    balancerREthStrategy,
    allAssets,
    pid: balancerREthPID,
  };

  const unitAmount = await units(amount, asset);

  log(`WETH in vault ${formatUnits(await weth.balanceOf(oethVault.address))}`);
  log(`rETH in vault ${formatUnits(await reth.balanceOf(oethVault.address))}`);

  const before = await logBalances(logParams);

  await oethVault
    .connect(strategist)
    .depositToStrategy(
      balancerREthStrategy.address,
      [asset.address],
      [unitAmount]
    );

  const after = await logBalances(logParams);

  // Should have liquidity in Balancer
  const strategyValuesDiff = after.strategyValues.total.sub(
    before.strategyValues.total
  );
  expect(strategyValuesDiff).to.approxEqualTolerance(unitAmount, 1);
}

async function logBalances({
  oeth,
  oethVault,
  asset,
  bpt,
  balancerVault,
  pid,
  balancerREthStrategy,
  allAssets,
}) {
  const oethSupply = await oeth.totalSupply();
  const bptSupply = await bpt.totalSupply();
  const vaultAssets = await asset.balanceOf(oethVault.address);

  log(`\nOETH total supply: ${formatUnits(oethSupply)}`);
  log(`BPT total supply : ${formatUnits(bptSupply)}`);
  log(`Vault assets     : ${formatUnits(vaultAssets)}`);

  const strategyValues = await getPoolValues(
    balancerREthStrategy,
    allAssets,
    balancerVault
  );

  const poolBalances = await getPoolBalances(balancerVault, pid);

  return {
    oethSupply,
    bptSupply,
    vaultAssets,
    strategyValues,
    poolBalances,
  };
}
