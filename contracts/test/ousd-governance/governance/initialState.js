const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getBlockNumber } = require("../../../utils/governance-helpers");
const { deploymentFixture } = require("../fixture");

// Tests for Governance
describe("Contract: Governance", async () => {
  beforeEach(async () => {
    ({ governance, timelock } = await deploymentFixture());
    [admin, user1, user2, voter, ...addrs] = await ethers.getSigners();
  });

  describe("Initial state", async () => {
    it("name should be OUSD Governance", async () => {
      expect(await governance.name()).to.be.eq("OUSD Governance");
    }),
      it("counting mode should be bravo", async () => {
        expect(await governance.COUNTING_MODE()).to.be.eq(
          "support=bravo&quorum=bravo"
        );
      }),
      it("voting delay should be one block", async () => {
        expect(await governance.votingDelay()).to.be.eq(1);
      }),
      it("voting period should be 17280", async () => {
        expect(await governance.votingPeriod()).to.be.eq(17280);
      }),
      it("quorum should be > 0", async () => {
        expect(await governance.quorum((await getBlockNumber()) - 1)).to.be.gt(
          0
        );
      }),
      it("voting power of admin should be 0", async () => {
        expect(
          await governance.getVotes(admin.address, (await getBlockNumber()) - 1)
        ).to.be.eq(0);
      }),
      it("timelock min delay should be 2 days", async () => {
        expect(await timelock.getMinDelay()).to.be.eq(86400 * 2);
      });
  });
});
