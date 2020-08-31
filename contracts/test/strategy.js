const { expect } = require("chai");

const { defaultFixture } = require("./_fixture");
const { loadFixture } = require("./helpers");

describe("Strategy selection", () => {
  it("Should be addable by Governor", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).addStrategy(ousd.address, 100);
  });

  it(
    "Should return a zero address for deposit when no strategy supports asset"
  );

  it(
    "Should prioritise withdrawing from Vault if sufficient amount of asset available"
  );

  it("Should withdraw from strategy");

  it("Should withdraw from multiple strategies if required");
});
