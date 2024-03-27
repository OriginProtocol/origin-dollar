const { expect } = require("chai");
const {
  createFixtureLoader,
  frxEthRedeemStrategyFixture,
} = require("./../_fixture");
const { ousdUnits, advanceTime, isCI } = require("../helpers");

describe("ForkTest: FraxETH Redeem Strategy", function () {
  this.timeout(360 * 1000);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(frxEthRedeemStrategyFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Post-deployment", function () {
    it("Should support WETH and frxETH", async () => {
      const { frxEthRedeemStrategy, weth, frxETH } = fixture;
      expect(await frxEthRedeemStrategy.supportsAsset(weth.address)).to.be.true;
      expect(await frxEthRedeemStrategy.supportsAsset(frxETH.address)).to.be
        .true;
    });
  });

  describe("Redeem Lifecyle", function () {
    it("Should redeem frxEth for WETH (multiple tickets)", async function () {
      await _testRedeemCycle(ousdUnits("1003.45"), 5);
    });
    it("Should redeem frxEth for WETH (1 exact ticket)", async function () {
      await _testRedeemCycle(ousdUnits("250"), 1);
    });
    it("Should redeem frxEth for WETH (1 small ticket)", async function () {
      await _testRedeemCycle(ousdUnits("0.23"), 1);
    });
    it("Should revert on zero amount", async function () {
      const { frxEthRedeemStrategy, frxETH, oethVault, strategist } = fixture;
      const txPromise = oethVault
        .connect(strategist)
        .depositToStrategy(frxEthRedeemStrategy.address, [frxETH.address], [0]);
      await expect(txPromise).to.be.revertedWith("No frxETH to redeem");
    });
  });

  describe("Strategist sent WETH", function () {
    it("Should return WETH to the vault", async function () {
      const { frxEthRedeemStrategy, weth, frxETH, oethVault, strategist } =
        fixture;
      const initialWeth = await weth.balanceOf(oethVault.address);
      await oethVault
        .connect(strategist)
        .depositToStrategy(
          frxEthRedeemStrategy.address,
          [weth.address, frxETH.address],
          [ousdUnits("1000"), ousdUnits("1000")]
        );
      const afterWeth = await weth.balanceOf(oethVault.address);
      expect(afterWeth).to.equal(initialWeth);
    });
  });

  describe("withdrawAll()", function () {
    it("Should withdraw all WETH, frxETH, and native ETH to the vault", async function () {
      const {
        frxEthRedeemStrategy,
        weth,
        frxETH,
        oethVault,
        strategist,
        daniel,
      } = fixture;

      // Deposit some WETH, frxETH, and native ETH to the strategy contract
      const wethAmount = ousdUnits("10.34");
      const frxEthAmount = ousdUnits("20.123");
      const nativeEthAmount = ousdUnits("5.2345");
      await weth
        .connect(daniel)
        .transfer(frxEthRedeemStrategy.address, wethAmount);
      await frxETH
        .connect(daniel)
        .transfer(frxEthRedeemStrategy.address, frxEthAmount);
      await strategist.sendTransaction({
        to: frxEthRedeemStrategy.address,
        value: nativeEthAmount,
      });

      // Get initial balances
      const initialWethBalanceVault = await weth.balanceOf(oethVault.address);
      const initialFrxEthBalanceVault = await frxETH.balanceOf(
        oethVault.address
      );
      const initialNativeEthBalanceVault = await oethVault.provider.getBalance(
        oethVault.address
      );

      // Call withdrawAll()
      await oethVault
        .connect(strategist)
        .withdrawAllFromStrategy(frxEthRedeemStrategy.address);

      // Check final balances
      const finalWethBalanceVault = await weth.balanceOf(oethVault.address);
      const finalFrxEthBalanceVault = await frxETH.balanceOf(oethVault.address);
      const finalNativeEthBalanceVault = await oethVault.provider.getBalance(
        oethVault.address
      );
      expect(finalWethBalanceVault.sub(initialWethBalanceVault)).to.equal(
        wethAmount.add(nativeEthAmount)
      );
      expect(finalFrxEthBalanceVault.sub(initialFrxEthBalanceVault)).to.equal(
        frxEthAmount
      );
      expect(finalNativeEthBalanceVault).to.equal(initialNativeEthBalanceVault);
    });

    it("Should handle the case when the strategy has no assets", async function () {
      const { frxEthRedeemStrategy, oethVault, strategist } = fixture;
      await oethVault
        .connect(strategist)
        .withdrawAllFromStrategy(frxEthRedeemStrategy.address);
    });
  });

  async function _getTickets(tx, frxEthRedeemStrategy) {
    const TICKET_TOPIC =
      "0x536614cc61a8a2c89cee49f31b1bd84fb4f55b2aea4c1b98a97ea9f77bc860f6";
    const receipt = await tx.wait();
    const datas = receipt.events.filter(
      (x) =>
        x.address == frxEthRedeemStrategy.address && x.topics[0] == TICKET_TOPIC
    );
    return datas.map((x) => parseInt(x.data.slice(2, 66), 16));
  }

  async function _testRedeemCycle(amount, expectedTickets) {
    const { frxEthRedeemStrategy, weth, frxETH, oethVault, strategist } =
      fixture;
    const initialEth = await weth.balanceOf(oethVault.address);
    const initialOutstanding = await frxEthRedeemStrategy.outstandingRedeems();
    expect(await frxEthRedeemStrategy.checkBalance(weth.address)).to.equal(
      await frxEthRedeemStrategy.outstandingRedeems()
    );
    expect(await frxEthRedeemStrategy.checkBalance(frxETH.address)).to.equal(0);

    const tx = await oethVault
      .connect(strategist)
      .depositToStrategy(
        frxEthRedeemStrategy.address,
        [frxETH.address],
        [amount]
      );
    const tickets = await _getTickets(tx, frxEthRedeemStrategy);
    expect(await frxEthRedeemStrategy.outstandingRedeems()).to.equal(
      initialOutstanding.add(amount)
    );
    expect(await frxEthRedeemStrategy.checkBalance(weth.address)).to.equal(
      await frxEthRedeemStrategy.outstandingRedeems()
    );
    expect(await frxEthRedeemStrategy.checkBalance(frxETH.address)).to.equal(0);

    await advanceTime(16 * 60 * 60 * 24);
    await frxEthRedeemStrategy
      .connect(strategist)
      .redeemTickets(tickets, amount);
    const afterEth = await weth.balanceOf(oethVault.address);
    expect(tickets.length).to.equal(expectedTickets);
    expect(afterEth.sub(initialEth)).to.equal(amount);
    expect(await frxEthRedeemStrategy.outstandingRedeems()).to.equal(
      initialOutstanding
    );
    expect(await frxEthRedeemStrategy.checkBalance(weth.address)).to.equal(
      await frxEthRedeemStrategy.outstandingRedeems()
    );
    expect(await frxEthRedeemStrategy.checkBalance(frxETH.address)).to.equal(0);
  }
});
