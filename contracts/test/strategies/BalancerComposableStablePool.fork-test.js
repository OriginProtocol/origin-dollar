const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers").utils;
const { BigNumber } = require("ethers");

const addresses = require("../../utils/addresses");
const { balancer_wstETH_sfrxETH_rETH_PID } = require("../../utils/constants");
const { units, oethUnits, forkOnlyDescribe, isCI } = require("../helpers");
const {
  balancerFrxETHwstETHeETHFixture,
  impersonateAndFundContract,
  createFixtureLoader,
  mineBlocks,
  mintWETH,
  tiltBalancerMetaStableWETHPool,
  untiltBalancerMetaStableWETHPool,
} = require("../_fixture");

const temporaryFork = require("../../utils/temporaryFork");

const log = require("../../utils/logger")(
  "test:fork:strategy:balancer:composable"
);

const loadBalancerFrxWstrETHFixture = createFixtureLoader(
  balancerFrxETHwstETHeETHFixture,
  {
    defaultStrategy: false,
  }
);

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool rETH/WETH Strategy",
  function () {
    this.timeout(0);
    this.retries(isCI ? 3 : 0);

    let fixture;

    describe("Post deployment", () => {
      beforeEach(async () => {
        fixture = await loadBalancerFrxWstrETHFixture();
      });
      it("Should have the correct initial state", async function () {
        const { balancerSfrxWstRETHStrategy, oethVault } = fixture;

        // Platform and OToken Vault
        expect(await balancerSfrxWstRETHStrategy.platformAddress()).to.equal(
          addresses.mainnet.wstETH_sfrxETH_rETH_BPT
        );
        expect(await balancerSfrxWstRETHStrategy.vaultAddress()).to.equal(
          oethVault.address
        );

        // Balancer and Aura config
        expect(await balancerSfrxWstRETHStrategy.balancerVault()).to.equal(
          addresses.mainnet.balancerVault
        );
        expect(await balancerSfrxWstRETHStrategy.balancerPoolId()).to.equal(
          balancer_wstETH_sfrxETH_rETH_PID
        );
        expect(
          await balancerSfrxWstRETHStrategy.auraRewardPoolAddress()
        ).to.equal(addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards);

        // Check deviation values
        expect(
          await balancerSfrxWstRETHStrategy.maxDepositDeviation()
        ).to.equal(oethUnits("0.01"));
        expect(
          await balancerSfrxWstRETHStrategy.maxWithdrawalDeviation()
        ).to.equal(oethUnits("0.01"));

        // Check addresses
        expect(await balancerSfrxWstRETHStrategy.rETH()).to.equal(
          addresses.mainnet.rETH
        );
        expect(await balancerSfrxWstRETHStrategy.wstETH()).to.equal(
          addresses.mainnet.wstETH
        );
        expect(await balancerSfrxWstRETHStrategy.stETH()).to.equal(
          addresses.mainnet.stETH
        );
        expect(await balancerSfrxWstRETHStrategy.sfrxETH()).to.equal(
          addresses.mainnet.sfrxETH
        );
        expect(await balancerSfrxWstRETHStrategy.frxETH()).to.equal(
          addresses.mainnet.frxETH
        );
      });

      it("Should safeApproveAllTokens", async function () {
        const {
          sfrxETH,
          wstETH,
          reth,
          sfrxETHwstETHrEthBPT,
          balancerSfrxWstRETHStrategy,
          timelock,
        } = fixture;
        const balancerVault = await balancerSfrxWstRETHStrategy.balancerVault();
        const auraRewardPool =
          await balancerSfrxWstRETHStrategy.auraRewardPoolAddress();

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
          const strategySigner = await impersonateAndFundContract(
            balancerSfrxWstRETHStrategy.address,
            "10"
          );
          await asset.connect(strategySigner).approve(spender, ZERO);
        };

        await resetAllowance(reth, balancerVault);
        await resetAllowance(sfrxETH, balancerVault);
        await resetAllowance(wstETH, balancerVault);
        await resetAllowance(sfrxETHwstETHrEthBPT, balancerVault);
        await resetAllowance(sfrxETHwstETHrEthBPT, auraRewardPool);

        await expectAllowanceRaw(
          ZERO,
          reth,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          ZERO,
          sfrxETH,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          ZERO,
          wstETH,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          ZERO,
          sfrxETHwstETHrEthBPT,
          balancerSfrxWstRETHStrategy.address,
          auraRewardPool
        );
        /* Some versions of Composable stable pools default max allowance
         * to the Balancer Vault:
         * https://github.com/balancer/balancer-v2-monorepo/blob/fc3e5735a07438ab506931f56adf64dede1441b1/pkg/pool-utils/contracts/BalancerPoolToken.sol#L60
         */
        // await expectAllowanceRaw(
        //   ZERO,
        //   sfrxETHwstETHrEthBPT,
        //   balancerSfrxWstRETHStrategy.address,
        //   balancerVault
        // );

        await balancerSfrxWstRETHStrategy
          .connect(timelock)
          .safeApproveAllTokens();

        await expectAllowanceRaw(
          MAX,
          reth,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          MAX,
          sfrxETH,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          MAX,
          wstETH,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          MAX,
          sfrxETHwstETHrEthBPT,
          balancerSfrxWstRETHStrategy.address,
          balancerVault
        );
        await expectAllowanceRaw(
          MAX,
          sfrxETHwstETHrEthBPT,
          balancerSfrxWstRETHStrategy.address,
          auraRewardPool
        );
      });
    });

    describe("Deposit", function () {
      beforeEach(async () => {
        fixture = await loadBalancerFrxWstrETHFixture();
        const { reth, frxETH, stETH, josh, oethVault } = fixture;
        await fundAccount([reth, frxETH, stETH], josh, oethVault.address);
      });
      it("Should deposit 5 stETH, 5 frxETH and 5 rETH in Balancer Composable Stable Pool strategy", async function () {
        const { reth, frxETH, stETH, sfrxETHwstETHrEthBPT } = fixture;
        await depositTest(
          fixture,
          [5, 5, 5],
          [stETH, frxETH, reth],
          sfrxETHwstETHrEthBPT
        );
      });
      it("Should deposit 30 stETH, 0 frxETH and 0 rETH in Balancer Composable Stable Pool strategy", async function () {
        const { reth, frxETH, stETH, sfrxETHwstETHrEthBPT } = fixture;
        await depositTest(
          fixture,
          [30, 0, 0],
          [stETH, frxETH, reth],
          sfrxETHwstETHrEthBPT
        );
      });
      it("Should deposit 0 stETH, 30 frxETH and 0 rETH in Balancer Composable Stable Pool strategy", async function () {
        const { reth, frxETH, stETH, sfrxETHwstETHrEthBPT } = fixture;
        await depositTest(
          fixture,
          [0, 30, 0],
          [stETH, frxETH, reth],
          sfrxETHwstETHrEthBPT
        );
      });
      it("Should deposit 0 stETH, 0 frxETH and 30 rETH in Balancer Composable Stable Pool strategy", async function () {
        const { reth, frxETH, stETH, sfrxETHwstETHrEthBPT } = fixture;
        await depositTest(
          fixture,
          [0, 0, 30],
          [stETH, frxETH, reth],
          sfrxETHwstETHrEthBPT
        );
      });
      it("Should deposit all rETH, stETH, frxETH in strategy to pool", async function () {
        const { balancerSfrxWstRETHStrategy, oethVault, reth, stETH, frxETH } =
          fixture;

        const rethInVaultBefore = await reth.balanceOf(oethVault.address);
        const stETHInVaultBefore = await stETH.balanceOf(oethVault.address);
        const frxETHInVaultBefore = await frxETH.balanceOf(oethVault.address);
        const strategyValueBefore = await balancerSfrxWstRETHStrategy[
          "checkBalance()"
        ]();

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        const rethUnits = oethUnits("7");
        const stethUnits = oethUnits("8");
        const frxethUnits = oethUnits("9");

        const rethValue = await reth.getEthValue(rethUnits);
        await reth
          .connect(oethVaultSigner)
          .transfer(balancerSfrxWstRETHStrategy.address, rethUnits);
        await stETH
          .connect(oethVaultSigner)
          .transfer(balancerSfrxWstRETHStrategy.address, stethUnits);
        await frxETH
          .connect(oethVaultSigner)
          .transfer(balancerSfrxWstRETHStrategy.address, frxethUnits);

        await balancerSfrxWstRETHStrategy.connect(oethVaultSigner).depositAll();

        const rethInVaultAfter = await reth.balanceOf(oethVault.address);
        const stETHInVaultAfter = await stETH.balanceOf(oethVault.address);
        const frxETHInVaultAfter = await frxETH.balanceOf(oethVault.address);
        const strategyValueAfter = await balancerSfrxWstRETHStrategy[
          "checkBalance()"
        ]();

        expect(rethInVaultBefore.sub(rethInVaultAfter)).to.equal(rethUnits);
        expect(stETHInVaultBefore.sub(stETHInVaultAfter)).to.equal(stethUnits);
        expect(frxETHInVaultBefore.sub(frxETHInVaultAfter)).to.equal(
          frxethUnits
        );
        expect(
          strategyValueAfter.sub(strategyValueBefore)
        ).to.approxEqualTolerance(
          rethValue.add(stethUnits).add(frxethUnits),
          0.05
        );
      });

      it("Should check balance for gas usage", async () => {
        const { balancerSfrxWstRETHStrategy, josh, stETH } = fixture;

        // Check balance in a transaction so the gas usage can be measured
        await balancerSfrxWstRETHStrategy["checkBalance(address)"](
          stETH.address
        );
        const tx = await balancerSfrxWstRETHStrategy
          .connect(josh)
          .populateTransaction["checkBalance(address)"](stETH.address);
        await josh.sendTransaction(tx);
      });
    });

    describe.only("Withdraw", function () {
      beforeEach(async () => {
        fixture = await loadBalancerFrxWstrETHFixture();
        const {
          balancerSfrxWstRETHStrategy,
          oethVault,
          strategist,
          reth,
          stETH,
          frxETH,
          josh,
        } = fixture;

        await fundAccount([reth, frxETH, stETH], josh, oethVault.address);

        await oethVault
          .connect(strategist)
          .depositToStrategy(
            balancerSfrxWstRETHStrategy.address,
            [stETH.address, reth.address, frxETH.address],
            [oethUnits("32"), oethUnits("32"), oethUnits("32")]
          );
      });

      // a list of WETH/RETH pairs
      const withdrawalTestCases = [
        ["10", "0", "0"],
        ["0", "8", "0"],
        ["0", "0", "11.23"],
        ["11.0023", "14.2", "8.123"],
        ["2.9543", "9.234", "0.234"],
        ["1.0001", "0", "0.000001"],
        ["9.99998", "0", "0"],
        ["0", "0", "9.99998"],
        ["0", "9.99998", "0"],
        ["0", "0", "7.00123"],
        ["0", "0", "0.210002"],
        ["38.432", "12.5643", "1.2343"],
        ["5.123452", "29.00123", "3.12342"],
        ["22.1232", "30.12342", "30.12332"],
      ];

      for (const [
        rethAmount,
        stethAmount,
        frxethAmount,
      ] of withdrawalTestCases) {
        it(`Should be able to withdraw ${rethAmount} RETH, ${stethAmount} stETH and ${frxethAmount} frxETH from the strategy`, async function () {
          const {
            reth,
            stETH,
            frxETH,
            balancerSfrxWstRETHStrategy,
            oethVault,
          } = fixture;

          const vaultstETHBalanceBefore = await stETH.balanceOf(
            oethVault.address
          );
          const vaultfrxETHBalanceBefore = await frxETH.balanceOf(
            oethVault.address
          );
          const vaultRethBalanceBefore = await reth.balanceOf(
            oethVault.address
          );
          const rethWithdrawAmount = await units(rethAmount, reth);
          const stETHWithdrawAmount = await units(stethAmount, stETH);
          const frxETHWithdrawAmount = await units(frxethAmount, frxETH);

          const oethVaultSigner = await impersonateAndFundContract(
            oethVault.address
          );

          // prettier-ignore
          await balancerSfrxWstRETHStrategy
            .connect(oethVaultSigner)["withdraw(address,address[],uint256[])"](
              oethVault.address,
              [stETH.address, frxETH.address, reth.address],
              [stETHWithdrawAmount, frxETHWithdrawAmount, rethWithdrawAmount]
            );

          expect(
            (await stETH.balanceOf(oethVault.address)).sub(
              vaultstETHBalanceBefore
            )
          ).to.approxEqualTolerance(stETHWithdrawAmount, 0.01);

          expect(
            (await frxETH.balanceOf(oethVault.address)).sub(
              vaultfrxETHBalanceBefore
            )
          ).to.approxEqualTolerance(frxETHWithdrawAmount, 0.01);

          expect(
            (await reth.balanceOf(oethVault.address)).sub(
              vaultRethBalanceBefore
            )
          ).to.approxEqualTolerance(rethWithdrawAmount, 0.01);
        });
      }

      it("Should be able to withdraw all of pool liquidity", async function () {
        const { oethVault, stETH, frxETH, reth, weth, balancerSfrxWstRETHStrategy } =
          fixture;

        const stEthBalanceBefore = await balancerSfrxWstRETHStrategy[
          "checkBalance(address)"
        ](stETH.address);
        const rethBalanceBefore = await balancerSfrxWstRETHStrategy[
          "checkBalance(address)"
        ](reth.address);
        const frxEthBalanceBefore = await balancerSfrxWstRETHStrategy[
          "checkBalance(address)"
        ](frxETH.address);

        const oethVaultSigner = await impersonateAndFundContract(
          oethVault.address
        );

        await balancerSfrxWstRETHStrategy
          .connect(oethVaultSigner)
          .withdrawAll();

        const stEthBalanceDiff = stEthBalanceBefore.sub(
          await balancerSfrxWstRETHStrategy["checkBalance(address)"](
            stETH.address
          )
        );
        const rethBalanceDiff = rethBalanceBefore.sub(
          await balancerSfrxWstRETHStrategy["checkBalance(address)"](
            reth.address
          )
        );
        const frxEthBalanceDiff = frxEthBalanceBefore.sub(
          await balancerSfrxWstRETHStrategy["checkBalance(address)"](
            frxETH.address
          )
        );

        expect(stEthBalanceDiff).to.be.gte(await units("15", reth), 1);
        expect(rethBalanceDiff).to.be.gte(await units("15", reth), 1);
        expect(frxEthBalanceDiff).to.be.gte(await units("15", weth), 1);
      });
    });

    describe("Large withdraw", function () {
      const depositAmount = 30000;
      let depositAmountUnits, oethVaultSigner;
      beforeEach(async () => {
        fixture = await loadBalancerFrxWstrETHFixture();
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
        const {
          balancerREthStrategy,
          rEthBPT,
          oethVault,
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
        fixture = await loadBalancerFrxWstrETHFixture();
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

        const sHarvester = await impersonateAndFundContract(
          oethHarvester.address
        );
        expect(await bal.balanceOf(oethHarvester.address)).to.equal(
          oethUnits("0")
        );
        expect(await aura.balanceOf(oethHarvester.address)).to.equal(
          oethUnits("0")
        );

        await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);
        await mineBlocks(1000);

        await balancerREthStrategy.connect(sHarvester).collectRewardTokens();

        expect(await bal.balanceOf(oethHarvester.address)).to.be.gte(
          oethUnits("0")
        );
        expect(await aura.balanceOf(oethHarvester.address)).to.be.gte(
          oethUnits("0")
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
        } = fixture;

        await depositTest(fixture, [5, 5], [weth, reth], rEthBPT);
        await mineBlocks(1000);

        const wethBalanceBefore = await weth.balanceOf(oethDripper.address);
        await oethHarvester.connect(josh)[
          // eslint-disable-next-line
          "harvestAndSwap(address)"
        ](balancerREthStrategy.address);

        const wethBalanceDiff = wethBalanceBefore.sub(
          await weth.balanceOf(oethDripper.address)
        );

        expect(wethBalanceDiff).to.be.gte(oethUnits("0"));
      });
    });
  }
);

async function fundAccount(assets, fromAccount, target, amount = "50") {
  for (let i = 0; i < assets.length; i++) {
    await assets[i].connect(fromAccount).transfer(target, parseUnits(amount));
  }
}

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
  strategyValueDiffPct = 1
) {
  const {
    oethVault,
    oeth,
    balancerSfrxWstRETHStrategy,
    balancerVault,
    sfrxETHwstETHrEthPID,
    reth,
    strategist,
  } = fixture;
  const logParams = {
    oeth,
    oethVault,
    bpt,
    balancerVault,
    strategy: balancerSfrxWstRETHStrategy,
    allAssets,
    pid: sfrxETHwstETHrEthPID,
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
    balancerSfrxWstRETHStrategy.address,
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
