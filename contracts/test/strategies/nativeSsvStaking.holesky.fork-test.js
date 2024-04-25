const { expect } = require("chai");

const addresses = require("../../utils/addresses");

const {
  loadSimpleOETHFixture,
} = require("./../_fixture");

describe("Holesky ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  // this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadSimpleOETHFixture();
  });

  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { nativeStakingSSVStrategy } = fixture;
      await expect(
        await nativeStakingSSVStrategy.WETH_TOKEN_ADDRESS()
      ).to.equal(addresses.holesky.WETH, "Incorrect WETH address set");
      await expect(await nativeStakingSSVStrategy.SSV_TOKEN_ADDRESS()).to.equal(
        addresses.holesky.SSV,
        "Incorrect SSV Token address"
      );
      await expect(
        await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS()
      ).to.equal(addresses.holesky.SSVNetwork, "Incorrect SSV Network address");
    });

    it.skip("Should check that the fuse interval is configured correctly", async () => {});
  });

  describe("Deposit/Allocation", function () {});

  describe("Withdraw", function () {});

  describe("Balance/Assets", function () {});
});
