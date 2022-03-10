const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe("Check vault value", () => {
  let vault, matt, dai;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    matt = fixture.matt;
    dai = fixture.dai;
  });

  function testLoss(opts) {
    return async () => {
      const { actual, max, shouldRevert } = opts;
      const checker = await ethers.getContract("VaultValueChecker");

      // Take snapshot
      await checker.takeSnapshot();

      // Alter funds
      if (actual > 0) {
        await vault.connect(matt).redeem(actual, 0);
      } else {
        await dai.connect(matt).transfer(vault.address, Math.abs(actual));
      }

      // Verify checkLoss behavior
      if (shouldRevert) {
        await expect(checker.checkLoss(max)).to.be.revertedWith(
          "Max loss exceeded"
        );
      } else {
        await checker.checkLoss(max);
      }
    };
  }

  it(
    "should succeed if loss was less than allowed",
    testLoss({ actual: 100, max: 200 })
  );
  it(
    "should revert if loss was greater that allowed",
    testLoss({ actual: 300, max: 200, shouldRevert: true })
  );
  it(
    "should succeed if value grew above expected",
    testLoss({ actual: -300, max: -200 })
  );
  it(
    "should revert if value grew, but not enough",
    testLoss({ actual: -100, max: -200, shouldRevert: true })
  );
});
