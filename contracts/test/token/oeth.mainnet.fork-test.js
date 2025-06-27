const { expect } = require("chai");
const { impersonateAndFund } = require("../../utils/signers");
const { loadDefaultFixture } = require("./../_fixture");
const { isCI, ethUnits, advanceTime } = require("./../helpers");
const hre = require("hardhat");

/**
 * Regarding hardcoded addresses:
 * The addresses are hardcoded in the test files (instead of
 * using them from addresses.js) intentionally. While importing and
 * using the variables from that file increases readability, it may
 * result in it being a single point of failure. Anyone can update
 * the addresses.js file and it may go unnoticed.
 *
 * Points against this: The on-chain data would still be correct,
 * making the tests to fail in case only addresses.js is updated.
 *
 * Still open to discussion.
 */

describe("ForkTest: OETH", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("verify state", () => {
    // These tests use a transaction to call a view function so the gas usage can be reported.
    it("Should get total value", async () => {
      const { oeth } = fixture;
      const eigenLayerStrategyContract =
        "0xa4c637e0f704745d182e4d38cab7e7485321d059";
      // 2 equals OptIn
      expect(await oeth.rebaseState(eigenLayerStrategyContract)).to.be.equal(2);
    });
    it("Should delegate or undelegate yield with strategist", async () => {
      const { oeth, strategist, matt, josh } = fixture;
      const impersonatedStrategist = await impersonateAndFund(
        strategist.address
      );
      expect(
        await oeth
          .connect(impersonatedStrategist)
          .delegateYield(matt.address, josh.address)
      ).to.not.be.revertedWith("Caller is not the Strategist or Governor");
      expect(
        await oeth.connect(impersonatedStrategist).undelegateYield(matt.address)
      ).to.not.be.revertedWith("Caller is not the Strategist or Governor");
    });
    it("Should earn yield even if EIP7702 user", async () => {
      const { oeth, oethVault, weth, usdc, josh } = fixture;
      const eip770UserAddress = josh.address;
      await hre.network.provider.send("hardhat_setCode", [
        eip770UserAddress,
        "0xef0100",
      ]); // 1 day
      const eip770User = await impersonateAndFund(eip770UserAddress);

      // Mint some OETH to the eip7702 user
      await weth.connect(eip770User).deposit({ value: ethUnits("13") });
      await weth.connect(eip770User).approve(oethVault.address, ethUnits("3"));
      await oethVault
        .connect(eip770User)
        .mint(weth.address, ethUnits("3"), ethUnits("0"));

      // EIP7702 keep 1 OETH and transfer 1 OETH to a smart contract (USDC in this case)
      // and transfer 1 OETH to a wallet (josh in this case)
      await oeth.connect(eip770User).transfer(usdc.address, ethUnits("1"));
      await oeth.connect(eip770User).transfer(josh.address, ethUnits("1"));
      const eip7702UserBalanceBefore = await oeth.balanceOf(eip770UserAddress);
      const scBalanceBefore = await oeth.balanceOf(usdc.address);
      const joshBalanceBefore = await oeth.balanceOf(josh.address);

      // Simulate yield
      await weth
        .connect(eip770User)
        .transfer(oethVault.address, ethUnits("10"));
      // Simulate time jump
      await advanceTime(24 * 60 * 60); // 1 day
      // Rebase the OETH vault
      await oethVault.rebase();
      const eip7702UserBalanceAfter = await oeth.balanceOf(eip770UserAddress);
      const scBalanceAfter = await oeth.balanceOf(usdc.address);
      const joshBalanceAfter = await oeth.balanceOf(josh.address);

      // Ensure the balance has increased i.e. yield was earned for both eip7702 user and wallet (josh)
      expect(joshBalanceAfter).to.be.gt(joshBalanceBefore);
      expect(eip7702UserBalanceAfter).to.be.gt(eip7702UserBalanceBefore);
      // Ensure the smart contract balance has not changed
      expect(scBalanceAfter).to.be.eq(scBalanceBefore);
    });
  });
});
