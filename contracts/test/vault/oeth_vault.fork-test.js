const { expect } = require("chai");

const { defaultFixture } = require("./../_fixture");
const addresses = require("../../utils/addresses");
const { loadFixture, forkOnlyDescribe } = require("./../helpers");

forkOnlyDescribe("ForkTest: Vault", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(defaultFixture);
  });

  describe("OETH Vault", () => {
    it("Should have the correct governor address set", async () => {
      const {
        oethVault,
        oethDripper,
        ConvexEthMetaStrategy,
        fraxEthStrategy,
        oeth,
        woeth,
        oethHarvester,
      } = fixture;

      const oethContracts = [
        oethVault,
        oethDripper,
        ConvexEthMetaStrategy,
        fraxEthStrategy,
        oeth,
        woeth,
        oethHarvester,
      ];

      for (let i = 0; i < oethContracts.length; i++) {
        expect(await oethContracts[i].governor()).to.equal(
          addresses.mainnet.OldTimelock
        );
      }
    });
  });
});
