const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
} = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const ethers = require("ethers");
const { formatUnits } = ethers.utils;
const { BigNumber } = ethers;

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe.only("ForkTest: Aerodrome AMO Strategy (Base)", function () {
  let fixture, oethbVault, oethb, weth, aerodromeAmoStrategy, governor, strategist, rafael, aeroSwapRouter;

  beforeEach(async () => {
    fixture = await baseFixture();
    weth = fixture.weth;
    oethb = fixture.oethb;
    oethbVault = fixture.oethbVault;
    aerodromeAmoStrategy = fixture.aerodromeAmoStrategy;
    governor = fixture.governor;
    strategist = fixture.strategist;
    rafael = fixture.rafael;
    aeroSwapRouter = fixture.aeroSwapRouter;

    await setup();
    await weth
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000"));
    await oethb
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000"));
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

  it("Should be able to deposit to the strategy", async () => {
    const { rafael } = fixture;
    await mintAndDepositToStrategy();
  });

  it("Should be able to deposit to the pool & rebalance", async () => {
    await mintAndDepositToStrategy({ amount: oethUnits("5") });
    await rebalance(
      oethUnits("0.00001"),
      oethUnits("0.000009"),
      true // _swapWETHs
    );
  });

  it("Should revert when there is not enough WETH to perform a swap", async () => {
    await swap({
      amount: oethUnits("5"),
      swapWeth: false
    })

    await expect(rebalance(
      oethUnits("0.02"),
      oethUnits("0.018"),
      true // _swapWETH
    )).to.be.reverted;
  });

  it("Should be able to rebalance the pool when price pushed to 1:1", async () => {
    await swap({
      amount: oethUnits("5"),
      swapWeth: false
    })

    // supply some WETH for the rebalance
    await mintAndDepositToStrategy({ amount: oethUnits("1") });

    await rebalance(
      oethUnits("0.055"),
      oethUnits("0.054"),
      true // _swapWETH
    );

    //await printPoolInfo();
  });

  it("Should be able to rebalance the pool when price pushed to close to 1 OETHb costing 1.0001 WETH", async () => {
    await printPoolInfo();
    await swap({
      amount: oethUnits("20.44"),
      swapWeth: true
    })
    await printPoolInfo();

    await rebalance(
      oethUnits("0.2"),
      oethUnits("0.19"),
      false // _swapWETH
    );

    await printPoolInfo();
  });

  it("Should have the correct net liquidity within some tolerance", async () => {
    

  });

  it("Even if WETH is running low should still leave some OETHb in the pool", async () => {
    

  });

  it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
    

  });

  const setup = async () => {
    await mintAndDepositToStrategy({ amount: oethUnits("5") });
    // deploy some liquidity into the [-1, 0] ticker without swapping
    // only called when the strategy has no liquidity position yet
    await depositLiquidityToPool();

    // move the price to pre-configured 20% value
    await rebalance(
      oethUnits("0.04"),
      oethUnits("0.03"),
      true // _swapWETH
    );
  }

  const printPoolInfo = async () => {
    const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();
    const poolPrice = Number((await aerodromeAmoStrategy.getPoolX96Price()).toString());
    const priceTick0 = Number((await aerodromeAmoStrategy.sqrtRatioX96Tick0()).toString());
    const priceTick1 = Number((await aerodromeAmoStrategy.sqrtRatioX96Tick1()).toString());

    let displayedPoolPrice = '';
    if (poolPrice > priceTick1) {
      displayedPoolPrice = 'smaller than 1.0000';
    } else if (poolPrice > priceTick0) {
      const tickPriceWidth = priceTick1 - priceTick0;
      const tickPosition = poolPrice - priceTick0;
      console.log("POSITION WITHIN TICK");
      console.log("tickPriceWidth", tickPriceWidth);
      console.log("tickPosition", tickPosition);
      const relativePosition = tickPosition / tickPriceWidth;
      const displayedPoolPrice = `${1 + 0.0001 * relativePosition}`;
    } else {
      displayedPoolPrice = 'greater than 1.0001';
    }

    console.log("--------- AERODROME POOL LP POSITION ---------");
    console.log("WETH amount      : ", formatUnits(amountWETH));
    console.log("OETHb amount     : ", formatUnits(amountOETHb));
    console.log("price of OETHb   : ", displayedPoolPrice);
  };

  const swap = async ({ amount, swapWeth }) => {
    const sqrtRatioX96Tick1000 = BigNumber.from("83290069058676223003182343270");
    const sqrtRatioX96TickM1000 = BigNumber.from("75364347830767020784054125655");
    await aeroSwapRouter
      .connect(rafael)
      .exactInputSingle({
        tokenIn: swapWeth ? weth.address : oethb.address,
        tokenOut: swapWeth ? oethb.address : weth.address,
        tickSpacing: 1,
        recipient: rafael.address,
        deadline: 9999999999,
        amountIn: amount,
        amountOutMinimum: 0, // slippage check
        sqrtPriceLimitX96: swapWeth ? sqrtRatioX96TickM1000 : sqrtRatioX96Tick1000
    })
  };

  const depositLiquidityToPool = async () => {
    await aerodromeAmoStrategy
      .connect(strategist)
      .depositLiquidity();
  }

  // TODO test we can not deposit liquidity that has already been deposited

  const rebalance = async (amountToSwap, minTokenReceived, swapWETH) => {
    await aerodromeAmoStrategy
      .connect(strategist)
      .rebalance(
        amountToSwap,
        minTokenReceived,
        swapWETH
      );
  }

  const mintAndDepositToStrategy = async ({ userOverride, amount } = {}) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");

    await oethbVault
      .connect(user)
      .mint(
        weth.address,
        amount,
        amount
      );

    await oethbVault
      .connect(governor)
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [amount],
      );
  };
});
