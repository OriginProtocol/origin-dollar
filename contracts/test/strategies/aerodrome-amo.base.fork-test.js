const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
} = require("../_fixture-base");
//const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe.only("ForkTest: Aerodrome AMO Strategy (Base)", function () {
  let fixture, oethbVault, weth, aerodromeAmoStrategy, governor, strategist, rafael;

  beforeEach(async () => {
    fixture = await baseFixture();
    weth = fixture.weth;
    oethbVault = fixture.oethbVault;
    aerodromeAmoStrategy = fixture.aerodromeAmoStrategy;
    governor = fixture.governor;
  });

  it("Should be able to deposit to the pool", async () => {
    const { rafael } = fixture;
    await mintAndDeposit(rafael);
  });

  it("Should be able to deposit to the pool & rebalance", async () => {
    const { rafael } = fixture;
    await mintAndDeposit(rafael);

  });

  // create initial position, swap out all the OETHb from the pool
  it("Should be able to mint OETHb to facilitate swap transaction", async () => {
    

  });


  it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
    

  });

  const rebalance = async (user) => {
    await oethbVault
      .connect(strategist)
      .rebalace(
      );
  }

  const mintAndDeposit = async (userOverride) => {
    const user = userOverride || rafael;

    await oethbVault
      .connect(user)
      .mint(
        weth.address,
        oethUnits("5"),
        oethUnits("5")
      );

    await oethbVault
      .connect(governor)
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [oethUnits("5")],
      );
  };
});
