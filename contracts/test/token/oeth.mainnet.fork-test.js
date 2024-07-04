const { expect } = require("chai");

const { loadDefaultFixture } = require("./../_fixture");
const { isCI } = require("./../helpers");

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
  });
});
