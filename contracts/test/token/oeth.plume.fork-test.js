const { createFixtureLoader } = require("../_fixture");
const { defaultPlumeFixture } = require("../_fixture-plume");
const { expect } = require("chai");

const plumeFixture = createFixtureLoader(defaultPlumeFixture);

describe("ForkTest: OETHp", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await plumeFixture();
  });

  it("Should have right symbol and name", async () => {
    const { oethp } = fixture;
    expect(await oethp.symbol()).to.eq("superOETHp");
    expect(await oethp.name()).to.eq("Super OETH");
    expect(await oethp.decimals()).to.equal(18);
  });

  it("Should have right symbol and name for 4626 vault", async () => {
    const { wOETHp } = fixture;
    expect(await wOETHp.symbol()).to.equal("wsuperOETHp");
    expect(await wOETHp.name()).to.equal("Wrapped Super OETH");
    expect(await wOETHp.decimals()).to.equal(18);
  });

  it("Should have the right governor", async () => {
    const { oethp } = fixture;
    const { timelockAddr } = await getNamedAccounts();
    expect(await oethp.governor()).to.eq(timelockAddr);
  });

  it("Should have the right Vault address", async () => {
    const { oethp, oethpVault } = fixture;
    expect(await oethp.vaultAddress()).to.eq(oethpVault.address);
  });
});
