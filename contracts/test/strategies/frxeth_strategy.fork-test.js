const { expect } = require("chai");
const ethers = require("ethers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const {
  createFixtureLoader,
  frxEthRedeemStrategyFixture,
} = require("./../_fixture");

const { ousdUnits, advanceTime, isCI } = require("../helpers");

describe.only("ForkTest: FraxETH Redeem Strategy", function () {
  this.timeout(360 * 1000);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(frxEthRedeemStrategyFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  //   shouldBehaveLikeGovernable(() => ({
  //     ...fixture,
  //     strategy: fixture.fraxEthRedeemStrategy,
  //   }));

  describe("Post-deployment", function () {
    it("Should support WETH and frxETH", async () => {
      const { frxEthRedeemStrategy, weth, frxETH } = fixture;

      expect(await frxEthRedeemStrategy.supportsAsset(weth.address)).to.be.true;
      expect(await frxEthRedeemStrategy.supportsAsset(frxETH.address)).to.be
        .true;
    });
  });

  describe("Redeem Lifecyle", function () {
    it("Should redeem frxEth for WETH", async function () {
      const { frxEthRedeemStrategy, weth, frxETH, oethVault, strategist } =
        fixture;
      const initialEth = await weth.balanceOf(oethVault.address);
      const tx = await oethVault
        .connect(strategist)
        .depositToStrategy(
          frxEthRedeemStrategy.address,
          [frxETH.address],
          [ousdUnits("1003.45")]
        );
      tickets = await getTickets(tx, frxEthRedeemStrategy);
      await advanceTime(16 * 60 * 60 * 24);
      await frxEthRedeemStrategy
        .connect(strategist)
        .redeemTickets(tickets, ousdUnits("1003.45"));
      const afterEth = await weth.balanceOf(oethVault.address);
      expect(afterEth.sub(initialEth)).to.equal(ousdUnits("1003.45"));
    });
  });

  async function getTickets(tx, frxEthRedeemStrategy) {
    const TICKET_TOPIC =
      "0x536614cc61a8a2c89cee49f31b1bd84fb4f55b2aea4c1b98a97ea9f77bc860f6";
    const receipt = await tx.wait();
    const datas = receipt.events.filter(
      (x) =>
        x.address == frxEthRedeemStrategy.address && x.topics[0] == TICKET_TOPIC
    );
    return datas.map((x) => parseInt(x.data.slice(2, 66), 16));
  }
});
