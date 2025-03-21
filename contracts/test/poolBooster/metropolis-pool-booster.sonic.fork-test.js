const { createFixtureLoader } = require("../_fixture");
const {
  defaultSonicFixture
} = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Metropolis Pool Booster", function () {
  let fixture, poolBoosterMetropolis, nick, wS, oSonicVault, oSonic;
  beforeEach(async () => {
    fixture = await sonicFixture();
    nick = fixture.nick;
    wS = fixture.wS;
    oSonicVault = fixture.oSonicVault;
    oSonic = fixture.oSonic;
    poolBoosterMetropolis = fixture.poolBoosterMetropolis;

    // mint some OS to Nick
    oSonicVault
      .connect(nick)
      .mint(wS.address, oethUnits("1000"), oethUnits("0"));
  });

  it("Should bribe 2 times in a row", async () => {
    // Give 10 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMetropolis.address, oethUnits("10"));
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      oethUnits("10")
    );

    // Bribe the pool booster
    await poolBoosterMetropolis.bribe();
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      oethUnits("0")
    );
  });
});
