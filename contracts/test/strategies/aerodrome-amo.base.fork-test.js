const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
} = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const ethers = require("ethers");
const { impersonateAndFund } = require("../../utils/signers");
const { formatUnits } = ethers.utils;
const { BigNumber } = ethers;

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Aerodrome AMO Strategy (Base)", function () {
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

  describe.only("Withdraw", function () {
    it("Should allow withdraw when the pool is 80:20 balanced", async () => {
      const { oethbVault, aerodromeAmoStrategy, rafael, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      const balanceBefore = await weth.balanceOf(rafael.address)

      const poolPrice = await aerodromeAmoStrategy.getPoolX96Price()

      // setup() moves the pool closer to 80:20
      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          rafael.address,
          weth.address,
          oethUnits("1")
        );
      
      // Make sure that 1 WETH and 4 OETHb were burned
      const [amountWETHAfter, amountOETHbAfter] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(amountWETH.sub(oethUnits("1")))
      expect(amountOETHbAfter).to.approxEqualTolerance(amountOETHb.sub(oethUnits("4")))

      // Make sure there's no price movement
      expect(await aerodromeAmoStrategy.getPoolX96Price()).to.eq(poolPrice)

      // And recipient has got it
      expect(await weth.balanceOf(rafael.address)).to.eq(balanceBefore.add(oethUnits("1")))
    })

    it("Should allow withdrawAll when the pool is 80:20 balanced", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth, oethb } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      const balanceBefore = await weth.balanceOf(oethbVault.address)
      const supplyBefore = await oethb.totalSupply();
      
      // setup() moves the pool closer to 80:20
      const [amountWETHBefore, amountOETHbBefore] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdrawAll();

      // // Make sure pool is empty
      // // TODO: This method reverts when there's nothing in the pool
      // const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();
      // expect(amountOETHb).to.eq(0)
      // expect(amountWETH).to.eq(0)

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(amountWETHBefore))

      // And supply has gone down
      expect(await oethb.totalSupply()).to.eq(supplyBefore.sub(amountOETHbBefore))
    })

    it("Should withdraw when there's little WETH in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, rafael, weth, oethb } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false
      })

      const balanceBefore = await weth.balanceOf(rafael.address)
      const supplyBefore = await oethb.totalSupply();

      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          rafael.address,
          weth.address,
          oethUnits("1")
        );
      
      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(amountWETH.sub(oethUnits("1")))
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(amountOETHb.div(amountWETH))
      
      // And recipient has got it
      console.log(balanceBefore.add(oethUnits("1")).toString(), (await weth.balanceOf(rafael.address)).toString())
      expect(await weth.balanceOf(rafael.address)).to.approxEqualTolerance(balanceBefore.add(oethUnits("1")))
      console.log("balance check")
      
      // And supply has gone down
      expect(await oethb.totalSupply()).to.eq(supplyBefore.sub(amountOETHb))
      console.log("Supply check")
    })

    it("Should withdrawAll when there's little WETH in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false
      })

      const balanceBefore = await weth.balanceOf(oethbVault.address)

      const [amountWETH,] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(amountWETH))
    })

    it("Should withdraw when there's little OETHb in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, rafael, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      // setup() moves the pool closer to 80:20

      // Drain out most of OETHb
      await swap({
        // Pool has 5 OETHb
        amount: oethUnits("3.5"),
        swapWeth: true
      })

      const balanceBefore = await weth.balanceOf(rafael.address)

      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          rafael.address,
          weth.address,
          oethUnits("1")
        );
      
      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(amountWETH.sub(oethUnits("1")))
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(amountOETHb.div(amountWETH))

      // And recipient has got it
      expect(await weth.balanceOf(rafael.address)).to.approxEqualTolerance(balanceBefore.add(oethUnits("1")))
    })

    it("Should withdrawAll when there's little OETHb in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false
      })

      const balanceBefore = await weth.balanceOf(oethbVault.address)

      const [amountWETH,] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(amountWETH))
    })
  })

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
