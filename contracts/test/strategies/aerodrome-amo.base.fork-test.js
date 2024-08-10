const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
} = require("../_fixture-base");
//const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Aerodrome AMO Strategy (Base)", function () {
  let fixture, oethbVault, weth, aerodromeAmoStrategy, governor;

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
    await mintAndDeposit(rafael);
  });

  it.only("Should be able to quote the amount required", async () => {
    const { aerodromeAmoStrategy, rafael } = fixture;

    await mintAndDeposit(rafael);

    const result = await aerodromeAmoStrategy
      .connect(rafael)
      .quotePriceAfterTokenSwap(oethUnits("0.00003"), false);

    console.log("result");
    // In the trace result we get the corre
    console.log(result);

  });

  const mintAndDeposit = async (user) => {
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
