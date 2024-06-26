const { expect } = require("chai");
const {
  createFixtureLoader,
  lidoWithdrawalStrategyFixture,
} = require("../_fixture");
const { ousdUnits, isCI } = require("../helpers");
const { impersonateAccount } = require("../../utils/signers");
const { parseUnits } = require("ethers/lib/utils");

describe("ForkTest: Lido Withdrawal Strategy", function () {
  this.timeout(360 * 1000);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(lidoWithdrawalStrategyFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Post-deployment", function () {
    it("Should support WETH and stETH", async () => {
      const { lidoWithdrawalStrategy, weth, stETH } = fixture;
      expect(await lidoWithdrawalStrategy.supportsAsset(weth.address)).to.be
        .true;
      expect(await lidoWithdrawalStrategy.supportsAsset(stETH.address)).to.be
        .true;
    });
  });

  describe("Redeem Lifecyle", function () {
    it("Should redeem stETH for WETH (multiple requests)", async function () {
      await _testWithdrawalCycle(ousdUnits("17003.45"), 18);
    });
    it("Should redeem stETH for WETH (1 request)", async function () {
      await _testWithdrawalCycle(ousdUnits("250"), 1);
    });
    it("Should redeem stETH for WETH (2 request)", async function () {
      await _testWithdrawalCycle(ousdUnits("1999.99"), 2);
    });
    it("Should redeem stETH for WETH (1 small request)", async function () {
      await _testWithdrawalCycle(ousdUnits("0.03"), 1);
    });
    it("Should revert on zero amount", async function () {
      const { lidoWithdrawalStrategy, stETH, oethVault, strategist } = fixture;
      const txPromise = oethVault
        .connect(strategist)
        .depositToStrategy(
          lidoWithdrawalStrategy.address,
          [stETH.address],
          [0]
        );
      await expect(txPromise).to.be.revertedWith("No stETH to withdraw");
    });
  });

  describe("Strategist sent WETH", function () {
    it("Should return WETH to the vault", async function () {
      const { lidoWithdrawalStrategy, weth, stETH, oethVault, strategist } =
        fixture;
      const initialWeth = await weth.balanceOf(oethVault.address);
      await oethVault
        .connect(strategist)
        .depositToStrategy(
          lidoWithdrawalStrategy.address,
          [weth.address, stETH.address],
          [ousdUnits("1000"), ousdUnits("1000")]
        );
      const afterWeth = await weth.balanceOf(oethVault.address);
      expect(afterWeth).to.equal(initialWeth);
    });
  });

  describe("withdrawAll()", function () {
    it("Should withdraw all WETH, stETH, and native ETH to the vault", async function () {
      const {
        lidoWithdrawalStrategy,
        weth,
        stETH,
        oethVault,
        strategist,
        daniel,
      } = fixture;

      // Deposit some WETH, stETH, and native ETH to the strategy contract
      const wethAmount = ousdUnits("10.34");
      const stETHAmount = ousdUnits("20.123");
      const nativeEthAmount = ousdUnits("5.2345");
      await weth
        .connect(daniel)
        .transfer(lidoWithdrawalStrategy.address, wethAmount);
      await stETH
        .connect(daniel)
        .transfer(lidoWithdrawalStrategy.address, stETHAmount);
      await strategist.sendTransaction({
        to: lidoWithdrawalStrategy.address,
        value: nativeEthAmount,
      });

      // Get initial balances
      const initialWethBalanceVault = await weth.balanceOf(oethVault.address);
      const initialStEthBalanceVault = await stETH.balanceOf(oethVault.address);
      const initialNativeEthBalanceVault = await oethVault.provider.getBalance(
        oethVault.address
      );

      // Call withdrawAll()
      await oethVault
        .connect(strategist)
        .withdrawAllFromStrategy(lidoWithdrawalStrategy.address);

      // Check final balances
      const finalWethBalanceVault = await weth.balanceOf(oethVault.address);
      const finalstEthBalanceVault = await stETH.balanceOf(oethVault.address);
      const finalNativeEthBalanceVault = await oethVault.provider.getBalance(
        oethVault.address
      );
      expect(finalWethBalanceVault.sub(initialWethBalanceVault))
        .to.gte(wethAmount.add(nativeEthAmount).sub(2))
        .lte(wethAmount.add(nativeEthAmount));
      expect(finalstEthBalanceVault.sub(initialStEthBalanceVault))
        .to.gte(
          // stETH transfers can leave 1-2 wei in the contract
          stETHAmount.sub(2)
        )
        .lte(stETHAmount);
      expect(finalNativeEthBalanceVault).to.equal(initialNativeEthBalanceVault);
    });

    it("Should handle the case when the strategy has no assets", async function () {
      const { lidoWithdrawalStrategy, oethVault, strategist } = fixture;
      await oethVault
        .connect(strategist)
        .withdrawAllFromStrategy(lidoWithdrawalStrategy.address);
    });
  });

  async function parseRequestIds(tx, lidoWithdrawalStrategy) {
    const WithdrawalRequestedTopic =
      "0x4a54e868001801e435d72d0f5a4ead23b6be3f49544fcfde1b83dd6d779a50f4";
    const receipt = await tx.wait();
    const log = receipt.events.find(
      (x) =>
        x.address == lidoWithdrawalStrategy.address &&
        x.topics[0] == WithdrawalRequestedTopic
    );
    const event = lidoWithdrawalStrategy.interface.parseLog(log);
    return event.args.requestIds;
  }

  async function finalizeRequests(requestIds, stETH, withdrawalQueue) {
    const stETHSigner = await impersonateAccount(stETH.address);
    const lastRequest = requestIds.slice(-1)[0];

    const maxShareRate = parseUnits("1200000000", 18);
    await withdrawalQueue
      .connect(stETHSigner)
      .finalize(lastRequest, maxShareRate);

    // check the first request is finalized
    const requestStatuses = await withdrawalQueue.getWithdrawalStatus(
      requestIds
    );
    expect(requestStatuses[0].isFinalized).to.be.true;
  }

  async function _testWithdrawalCycle(amount, expectedRequests) {
    const {
      lidoWithdrawalStrategy,
      lidoWithdrawalQueue,
      weth,
      stETH,
      oethVault,
      strategist,
    } = fixture;
    const initialEth = await weth.balanceOf(oethVault.address);
    const initialOutstanding =
      await lidoWithdrawalStrategy.outstandingWithdrawals();
    expect(await lidoWithdrawalStrategy.checkBalance(weth.address)).to.equal(
      await lidoWithdrawalStrategy.outstandingWithdrawals()
    );
    expect(await lidoWithdrawalStrategy.checkBalance(stETH.address)).to.equal(
      0
    );

    const tx = await oethVault
      .connect(strategist)
      .depositToStrategy(
        lidoWithdrawalStrategy.address,
        [stETH.address],
        [amount]
      );
    expect(await lidoWithdrawalStrategy.outstandingWithdrawals())
      .to.gte(initialOutstanding.add(amount).sub(2))
      .lte(initialOutstanding.add(amount));
    expect(await lidoWithdrawalStrategy.checkBalance(weth.address)).to.equal(
      await lidoWithdrawalStrategy.outstandingWithdrawals()
    );
    expect(await lidoWithdrawalStrategy.checkBalance(stETH.address)).to.equal(
      0
    );

    const requestIds = await parseRequestIds(tx, lidoWithdrawalStrategy);

    // finalize the requests so they can be claimed
    await finalizeRequests(requestIds, stETH, lidoWithdrawalQueue);

    // Claim finalized requests
    await lidoWithdrawalStrategy
      .connect(strategist)
      .claimWithdrawals(requestIds, amount);

    const afterEth = await weth.balanceOf(oethVault.address);
    expect(requestIds.length).to.equal(expectedRequests);
    expect(afterEth.sub(initialEth)).to.gte(amount.sub(2)).lte(amount);
    expect(await lidoWithdrawalStrategy.outstandingWithdrawals()).to.equal(
      initialOutstanding
    );
    expect(await lidoWithdrawalStrategy.checkBalance(weth.address)).to.equal(
      await lidoWithdrawalStrategy.outstandingWithdrawals()
    );
    expect(await lidoWithdrawalStrategy.checkBalance(stETH.address)).to.equal(
      0
    );
  }
});
