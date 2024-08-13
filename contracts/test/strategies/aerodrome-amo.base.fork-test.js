const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
} = require("../_fixture-base");
const { expect } = require("chai");
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
    strategist = fixture.strategist;
    rafael = fixture.rafael;
  });

  describe("ForkTest: Initial state (Base)", function () {
    it("Should have the correct initial state", async function () {
      // correct pool weth share variance
      expect(await aerodromeAmoStrategy.poolWethShareVarianceAllowed()).to.equal(
        200
      );

      // correct withdrawal liquity share
      expect(await aerodromeAmoStrategy.withdrawLiquidityShare()).to.equal(
        9900
      );

      // correct pool weth share
      expect(await aerodromeAmoStrategy.poolWethShare()).to.equal(
        2000
      );
    }); 
  });

  it("Should be able to deposit to the pool", async () => {
    const { rafael } = fixture;
    await mintAndDeposit(rafael);
  });

  it.only("Should be able to deposit to the pool & rebalance", async () => {
    const { rafael } = fixture;
    await mintAndDeposit(rafael);

    await rebalance(
      oethUnits("0.0073"),
      oethUnits("0.0072"),
      false // swap OETHb for WETH
    );

    await mintAndDeposit(rafael);

    await rebalance(
      oethUnits("0.0000001"),
      oethUnits("0.00000009"),
      false // swap OETHb for WETH
    );

  });

  // create initial position, swap out all the OETHb from the pool
  it("Should be able to mint OETHb to facilitate swap transaction", async () => {
    

  });


  it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
    

  });

  const rebalance = async (amountToSwap, minTokenReceived, swapWETH) => {
    await aerodromeAmoStrategy
      .connect(strategist)
      .rebalance(
        amountToSwap,
        minTokenReceived,
        swapWETH
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
