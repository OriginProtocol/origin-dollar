const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { decideRebalance, REASONS } = require("../actions/ousdV4Rebalance");

// The action runs every 5 minutes and only sends `rebalance` when this returns
// send = true. A wrong "skip" leaves bought USDe in the pool for arbs to buy
// back; a wrong "send" only wastes gas, so pin the skip edges.
describe("Unit: ousdV4Rebalance decideRebalance", () => {
  const reason = (name) => REASONS.indexOf(name);
  const decide = ({ needed, name, pending = 0, min = 10 }) =>
    decideRebalance({
      needed,
      reason: reason(name),
      pendingToken1: BigNumber.from(pending),
      minToken1: BigNumber.from(min),
    });

  it("mirrors the module's Reason enum order", () => {
    expect(REASONS).to.deep.equal([
      "None",
      "NotConfigured",
      "Paused",
      "Balanced",
      "PullNeeded",
      "ReAddNeeded",
      "PriceInRange",
      "ExposureCap",
      "AddFailed",
    ]);
  });

  it("skips when the module reports nothing to do", () => {
    for (const name of ["Balanced", "Paused", "PriceInRange", "ExposureCap"]) {
      expect(decide({ needed: false, name })).to.deep.equal({
        send: false,
        why: name,
      });
    }
  });

  it("skips a pull below the dust threshold", () => {
    expect(
      decide({ needed: true, name: "PullNeeded", pending: 9 })
    ).to.deep.equal({ send: false, why: "Dust" });
  });

  it("sends a pull at the dust threshold", () => {
    expect(
      decide({ needed: true, name: "PullNeeded", pending: 10 })
    ).to.deep.equal({ send: true, why: "PullNeeded" });
  });

  it("sends a re-add whatever the position holds", () => {
    expect(
      decide({ needed: true, name: "ReAddNeeded", pending: 0 })
    ).to.deep.equal({ send: true, why: "ReAddNeeded" });
  });

  it("labels an unknown reason instead of throwing", () => {
    const result = decideRebalance({
      needed: false,
      reason: 42,
      pendingToken1: BigNumber.from(0),
      minToken1: BigNumber.from(0),
    });
    expect(result).to.deep.equal({ send: false, why: "Reason(42)" });
  });
});
