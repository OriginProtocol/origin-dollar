const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const {
  addActualBalancesToSquidData,
  compareUpgradedContractBalances,
  testTransfersOnTokenContract
} = require("./../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should have right symbol and name", async () => {
    const { oethb } = fixture;
    expect(await oethb.symbol()).to.eq("superOETHb");
    expect(await oethb.name()).to.eq("Super OETH");
    expect(await oethb.decimals()).to.equal(18);
  });

  it("Should have right symbol and name for 4626 vault", async () => {
    const { wOETHb } = fixture;
    expect(await wOETHb.symbol()).to.equal("wsuperOETHb");
    expect(await wOETHb.name()).to.equal("Wrapped Super OETH");
    expect(await wOETHb.decimals()).to.equal(18);
  });

  it("Should have the right governor", async () => {
    const { oethb } = fixture;
    expect(await oethb.governor()).to.eq(addresses.base.timelock);
  });

  it("Should have the right Vault address", async () => {
    const { oethb, oethbVault } = fixture;
    expect(await oethb.vaultAddress()).to.eq(oethbVault.address);
  });

  // run this test by skipping the token contract upgrade so the resulted populated file
  // has the actual balances on chain before the contract upgrade
  it("Fetch the actual on chain data", async () => {
    const { oethb } = fixture;
    await addActualBalancesToSquidData('./soethBalances.csv', './soethBalancesCombined.csv', oethb);
  });

  // run this test with the token contract upgrade so the balances from the previous
    // test can be compared to the balances after the upgrade
  it("Compare the data before and after the upgrade", async () => {
    const { oethb } = fixture;
    await compareUpgradedContractBalances('./soethBalancesCombined.csv', oethb);
  });

  // execute transfer and compare balances
  it("Execute transfer and inspect balances", async () => {
    const { oethb } = fixture;
    await testTransfersOnTokenContract('./soethBalancesCombined.csv', oethb);
  });
});
