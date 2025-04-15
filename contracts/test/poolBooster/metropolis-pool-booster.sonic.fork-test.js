const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Metropolis Pool Booster", function () {
  let fixture,
    poolBoosterFactoryMetropolis,
    nick,
    wS,
    oSonicVault,
    oSonic,
    governor;
  beforeEach(async () => {
    fixture = await sonicFixture();
    nick = fixture.nick;
    wS = fixture.wS;
    oSonicVault = fixture.oSonicVault;
    oSonic = fixture.oSonic;
    poolBoosterFactoryMetropolis = fixture.poolBoosterFactoryMetropolis;
    governor = fixture.governor;

    // mint some OS to Nick
    await oSonicVault
      .connect(nick)
      .mint(wS.address, oethUnits("1000000"), oethUnits("0"));
  });

  it("Should deploy a Pool Booster for a Metropolis pool", async () => {
    await createPB(addresses.sonic.Metropolis.Pools.OsMoon, "1");
    expect(await poolBoosterFactoryMetropolis.poolBoosterLength()).to.equal(1);
  });

  it("Should bribe 2 times in a row", async () => {
    const poolBoosterMetropolis = await createPB(
      addresses.sonic.Metropolis.Pools.OsMoon,
      "1"
    );
    // Give 10 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMetropolis.address, oethUnits("100000"));

    // Bribe the pool booster
    let tx = await poolBoosterMetropolis.bribe();
    await expect(tx).to.emittedEvent("BribeExecuted", [oethUnits("100000")]);
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      oethUnits("0")
    );

    // Give 10 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMetropolis.address, oethUnits("500000"));

    // Bribe the pool booster
    tx = await poolBoosterMetropolis.bribe();
    await expect(tx).to.emittedEvent("BribeExecuted", [oethUnits("500000")]);
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      oethUnits("0")
    );
  });

  it("Should not bribe if amount is too small", async () => {
    const poolBoosterMetropolis = await createPB(
      addresses.sonic.Metropolis.Pools.OsMoon,
      "1"
    );
    // First test to ensure that amount is lower than immutable MIN_BRIBE_AMOUNT.
    // Give 100 OS to the pool booster
    await oSonic.connect(nick).transfer(poolBoosterMetropolis.address, "100"); // 100 wei of OS

    // Bribe the pool booster
    await poolBoosterMetropolis.bribe();
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      "100"
    );

    // Second test to ensure that amount is lower than minBribeAmount required from rewardFactory.
    // Give 1e12 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMetropolis.address, "1000000000000"); // 1e12 wei of OS

    // Bribe the pool booster
    await poolBoosterMetropolis.bribe();
    expect(await oSonic.balanceOf(poolBoosterMetropolis.address)).to.equal(
      "1000000000100"
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
