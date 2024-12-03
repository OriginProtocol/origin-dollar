const { loadDefaultFixture } = require("./../_fixture");
const {
  isCI,
  addActualBalancesToSquidData,
  compareUpgradedContractBalances,
  testTransfersOnTokenContract
} = require("./../helpers");

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

describe("ForkTest: OUSD", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("verify state", () => {
    // run this test by skipping the token contract upgrade so the resulted populated file
    // has the actual balances on chain before the contract upgrade
    it("Fetch the actual on chain data", async () => {
      const { ousd } = fixture;
      await addActualBalancesToSquidData('./ousdBalances.csv', './ousdBalancesCombined.csv', ousd);
    });

    // run this test with the token contract upgrade so the balances from the previous
    // test can be compared to the balances after the upgrade
    it("Compare the data before and after the upgrade", async () => {
      const { ousd } = fixture;
      await compareUpgradedContractBalances('./ousdBalancesCombined.csv', ousd);
    });

    // execute transfer and compare balances
    it("Execute transfer and inspect balances", async () => {
      const { ousd } = fixture;
      await testTransfersOnTokenContract('./ousdBalancesCombined.csv', ousd);
    });
  });
});
