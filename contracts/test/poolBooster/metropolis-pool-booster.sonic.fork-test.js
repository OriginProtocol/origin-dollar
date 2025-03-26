const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Metropolis Pool Booster", function () {
  let fixture, poolBoosterFactoryMetropolis, nick, wS, oSonicVault, oSonic, governor;
  beforeEach(async () => {
    fixture = await sonicFixture();
    nick = fixture.nick;
    wS = fixture.wS;
    oSonicVault = fixture.oSonicVault;
    oSonic = fixture.oSonic;
    poolBoosterFactoryMetropolis = fixture.poolBoosterFactoryMetropolis;
    governor = fixture.governor;

    // mint some OS to Nick
    oSonicVault
      .connect(nick)
      .mint(wS.address, oethUnits("1000"), oethUnits("0"));
  });

  it("Should deploy a Pool Booster for a Metropolis pool", async () => {
    await createPB("0x3987a13d675c66570bc28c955685a9bca2dcf26e", "1");
    expect(await poolBoosterFactoryMetropolis.poolBoosterLength()).to.equal(1);
  });

  it("Should bribe 2 times in a row", async () => {
    const poolBoosterMetropolis = await createPB(
      "0x3987a13d675c66570bc28c955685a9bca2dcf26e",
      "1"
    );
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

  async function createPB(poolAddress, salt) {
    await poolBoosterFactoryMetropolis
      .connect(governor)
      .createPoolBoosterMetropolis(poolAddress, salt);
    const boostersCount =
      await poolBoosterFactoryMetropolis.poolBoosterLength();
    const boosterEntry = await poolBoosterFactoryMetropolis.poolBoosters(
      boostersCount.sub(1)
    );
    const cont = await ethers.getContractAt(
      "PoolBoosterMetropolis",
      boosterEntry.boosterAddress
    );
    return cont;
  }
});

// tx example
// creating a Rewarder: https://app.blocksec.com/explorer/tx/sonic/0xddf6b5a2d400df66f15e7b0fb0010d7bc91e11e2c6d87216906aae12fa0f08a9
// funding and bribe: https://app.blocksec.com/explorer/tx/sonic/0xf2ad93507d0c159100d4e6ca97cb80304752ee14bb04816af79508a42bb868d5
