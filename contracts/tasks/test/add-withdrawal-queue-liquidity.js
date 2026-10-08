const { expect } = require("chai");
const { BigNumber } = require("ethers");

const {
  computeClaimableToAdd,
} = require("../actions/otokenAddWithdrawalQueueLiquidity");

// The action runs every 10 minutes and only sends addWithdrawalQueueLiquidity
// when this off-chain mirror of VaultCore._addWithdrawalQueueLiquidity returns
// a non-zero amount. A wrong zero silently leaves claims unfunded, so pin the
// edge cases that decide skip vs. send.
describe("Unit: otokenAddWithdrawalQueueLiquidity computeClaimableToAdd", () => {
  const compute = ({ queued, claimable, claimed, balance }) =>
    computeClaimableToAdd({
      queued: BigNumber.from(queued),
      claimable: BigNumber.from(claimable),
      claimed: BigNumber.from(claimed),
      balance: BigNumber.from(balance),
    });

  it("adds nothing when the queue is fully funded", () => {
    const { added, shortfall } = compute({
      queued: 100,
      claimable: 100,
      claimed: 40,
      balance: 1000,
    });
    expect(shortfall.toNumber()).to.equal(0);
    expect(added.toNumber()).to.equal(0);
  });

  it("adds nothing when the balance only covers already-allocated funds", () => {
    // allocated = claimable - claimed = 60
    const { added, allocated } = compute({
      queued: 200,
      claimable: 100,
      claimed: 40,
      balance: 50,
    });
    expect(allocated.toNumber()).to.equal(60);
    expect(added.toNumber()).to.equal(0);
  });

  it("adds nothing when the balance exactly equals the allocated funds", () => {
    const { added } = compute({
      queued: 200,
      claimable: 100,
      claimed: 40,
      balance: 60,
    });
    expect(added.toNumber()).to.equal(0);
  });

  it("adds the full shortfall when unallocated funds exceed it", () => {
    // shortfall = 100, unallocated = 500 - 60 = 440
    const { added } = compute({
      queued: 200,
      claimable: 100,
      claimed: 40,
      balance: 500,
    });
    expect(added.toNumber()).to.equal(100);
  });

  it("adds only the unallocated funds when they are below the shortfall", () => {
    // shortfall = 100, unallocated = 90 - 60 = 30
    const { added } = compute({
      queued: 200,
      claimable: 100,
      claimed: 40,
      balance: 90,
    });
    expect(added.toNumber()).to.equal(30);
  });
});
