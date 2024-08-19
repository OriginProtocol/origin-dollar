const hre = require("hardhat");
const { createFixtureLoader } = require("../_fixture");

const {
  defaultBaseFixture,
} = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const ethers = require("ethers");
const { impersonateAndFund } = require("../../utils/signers");
//const { formatUnits } = ethers.utils;
const { BigNumber } = ethers;

const baseFixture = createFixtureLoader(defaultBaseFixture);
const { setERC20TokenBalance } = require("../_fund");
const futureEpoch = 1924064072;

describe("ForkTest: Aerodrome AMO Strategy empty pool setup (Base)", function () {
  let fixture, oethbVault, oethb, weth, aerodromeAmoStrategy, governor, strategist, rafael, aeroSwapRouter, aeroNftManager;

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
    aeroNftManager = fixture.aeroNftManager;

    await setupEmpty();

    await weth
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000"));
    await oethb
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000"));
  });

  // Haven't found away to test for this in the strategy contract yet
  it.skip("Revert when there is no token id yet and no liquidity to perform the swap.", async () => {
    const amount = oethUnits("5");
    await oethbVault
      .connect(rafael)
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

    await expect(aerodromeAmoStrategy
      .connect(strategist)
      .rebalance(
        oethUnits("0.001"),
        oethUnits("0.0008"),
        false
      )).to.be.revertedWith("Can not rebalance empty pool");

  });

  const setupEmpty = async () => {
    const poolDeployer = await impersonateAndFund("0xFD9E6005187F448957a0972a7d0C0A6dA2911236");

    // remove all existing liquidity from the pool
    for (const tokenId of [342186, 413296]) {
      const { liquidity } = await aeroNftManager
        .connect(poolDeployer)
        .positions(tokenId);

      await aeroNftManager
        .connect(poolDeployer)
        .decreaseLiquidity({
          "tokenId": tokenId,
          "liquidity": liquidity,
          "amount0Min": 0,
          "amount1Min": 0,
          "deadline": futureEpoch
        });
    }
  }
});

describe("ForkTest: Aerodrome AMO Strategy (Base)", function () {
  let fixture, oethbVault, oethb, aero, weth, aerodromeAmoStrategy, governor, strategist, rafael, aeroSwapRouter;

  beforeEach(async () => {
    fixture = await baseFixture();
    weth = fixture.weth;
    aero = fixture.aero;
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
        oethUnits("0.02")
      );

      // correct withdrawal liquity share
      expect(await aerodromeAmoStrategy.withdrawLiquidityShare()).to.equal(
        oethUnits("0.99")
      );

      // correct pool weth share
      expect(await aerodromeAmoStrategy.poolWethShare()).to.equal(
        oethUnits("0.20")
      );

      // correct harvester set
      expect(await aerodromeAmoStrategy.harvesterAddress()).to.equal(
        await strategist.getAddress()
      );
    }); 
  });

  describe("Configuration", function () {
    it("Governor can set the pool weth share", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await aerodromeAmoStrategy
        .connect(governor)
        .setPoolWethShare(oethUnits("0.5"));

      expect(await aerodromeAmoStrategy.poolWethShare()).to.equal(
        oethUnits("0.5")
      );
    });

    it("Only the governor can set the pool weth share", async () => {
      const { rafael, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(rafael)
        .setPoolWethShare(oethUnits("0.5"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not set too large or too small pool weth share", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(governor)
        .setPoolWethShare(oethUnits("1"))
      ).to.be.revertedWith("Invalid poolWethShare amount");

      await expect(aerodromeAmoStrategy
        .connect(governor)
        .setPoolWethShare(oethUnits("0"))
      ).to.be.revertedWith("Invalid poolWethShare amount");

    });

    it("Governor can set the withdraw liquidity share", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await aerodromeAmoStrategy
        .connect(governor)
        .setWithdrawLiquidityShare(oethUnits("0.98"));

      expect(await aerodromeAmoStrategy.withdrawLiquidityShare()).to.equal(
        oethUnits("0.98")
      );
    });

    it("Only the governor can set the withdraw liquidity share", async () => {
      const { rafael, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(rafael)
        .setWithdrawLiquidityShare(oethUnits("0.98"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not set too large withdraw liquidity share", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(governor)
        .setWithdrawLiquidityShare(oethUnits("1"))
      ).to.be.revertedWith("Invalid withdrawLiquidityShare amount");
    });

    it("Governor can set the pool weth share allowance allowed", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await aerodromeAmoStrategy
        .connect(governor)
        .setPoolWethShareVarianceAllowed(oethUnits("0.39"));

      expect(await aerodromeAmoStrategy.poolWethShareVarianceAllowed()).to.equal(
        oethUnits("0.39")
      );
    });

    it("Only the governor can set the pool weth share allowance allowed", async () => {
      const { rafael, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(rafael)
        .setPoolWethShareVarianceAllowed(oethUnits("0.98"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not set too large pool weth share allowance allowed", async () => {
      const { governor, aerodromeAmoStrategy} = fixture;

      await expect(aerodromeAmoStrategy
        .connect(governor)
        .setPoolWethShareVarianceAllowed(oethUnits("0.40"))
      ).to.be.revertedWith("Invalid poolWethShareVariance");
    });
  });

  describe("Harvest rewards", function () {
    it("Should be able to collect reward tokens", async () => {
      const strategistAddr = await strategist.getAddress();

      await setERC20TokenBalance(aerodromeAmoStrategy.address, aero, "1337", hre);
      const aeroBalanceBefore = await aero.balanceOf(strategistAddr);
      await aerodromeAmoStrategy
        .connect(strategist)
        .collectRewardTokens();

      const aeroBalancediff = (await aero.balanceOf(strategistAddr)).sub(aeroBalanceBefore);

      expect(aeroBalancediff).to.equal(oethUnits("1337"));

    });
  });

  describe("Withdraw", function () {
    it("Should allow withdraw when the pool is 80:20 balanced", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      const balanceBefore = await weth.balanceOf(oethbVault.address)

      const poolPrice = await aerodromeAmoStrategy.getPoolX96Price()

      // setup() moves the pool closer to 80:20
      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          oethbVault.address,
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
      expect(await weth.balanceOf(oethbVault.address)).to.eq(balanceBefore.add(oethUnits("1")))

      // Little to no weth should be left on the strategy contract - 10 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(BigNumber.from("10"));
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
      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountOETHb).to.eq(0)
      expect(amountWETH).to.eq(0)

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(amountWETHBefore))

      // And supply has gone down
      expect(await oethb.totalSupply()).to.eq(supplyBefore.sub(amountOETHbBefore))

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(oethUnits("0"));
    })

    it("Should withdraw when there's little WETH in the pool", async () => {
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

      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          oethbVault.address,
          weth.address,
          oethUnits("1")
        );
      
      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(amountWETH.sub(oethUnits("1")))
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(amountOETHb.div(amountWETH))
      
      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(oethUnits("1")))

      // Little to no weth should be left on the strategy contract - 10 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(BigNumber.from("10"));
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

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(oethUnits("0"));
    })

    it("Should withdraw when there's little OETHb in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture
      
      const impersonatedVaultSigner = await impersonateAndFund(oethbVault.address)

      // setup() moves the pool closer to 80:20

      // Drain out most of OETHb
      await swap({
        // Pool has 5 OETHb
        amount: oethUnits("3.5"),
        swapWeth: true
      })

      const balanceBefore = await weth.balanceOf(oethbVault.address)

      const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner)
        .withdraw(
          oethbVault.address,
          weth.address,
          oethUnits("1")
        );
      
      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] = await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(amountWETH.sub(oethUnits("1")))
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(amountOETHb.div(amountWETH))

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(balanceBefore.add(oethUnits("1")))

      // Little to no weth should be left on the strategy contract - 10 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(BigNumber.from("10"));
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

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(oethUnits("0"));
    })
  })

  describe("Deposit and rebalance", function () {
    it("Should be able to deposit to the strategy", async () => {
      await mintAndDepositToStrategy();
    });

    it("Should be able to deposit to the pool & rebalance", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      // prettier-ignore
      const tx = await rebalance(
        oethUnits("0.00001"),
        oethUnits("0.000009"),
        true // _swapWETHs
      );

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");

    });

    it("Should check that add liquidity in difference cases leaves no to little weth on the contract", async () => {
      const amount = oethUnits("5");

      await oethbVault
        .connect(rafael)
        .mint(
          weth.address,
          amount,
          amount
        );
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(oethUnits("0"));

      await oethbVault
      .connect(governor)
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [amount],
      );
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(amount);

      await expect(aerodromeAmoStrategy
        .connect(strategist)
        .rebalance(
          oethUnits("0"),
          oethUnits("0"),
          false
        )
      );

      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(oethUnits("0"));
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
      )).to.be.revertedWith("NotEnoughWethForSwap");
    });

    it("Should revert when pool rebalance is off target", async () => {
      await expect(rebalance(
        oethUnits("0.04"),
        oethUnits("0.035"),
        true // _swapWETH
      )).to.be.revertedWith("PoolRebalanceOutOfBounds");
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
    });

    it("Should be able to rebalance the pool when price pushed to close to 1 OETHb costing 1.0001 WETH", async () => {
      await swap({
        amount: oethUnits("20.44"),
        swapWeth: true
      })

      await rebalance(
        oethUnits("0.205"),
        oethUnits("0.20"),
        false // _swapWETH
      );
    });

    it("Should have the correct balance within some tolerance", async () => {
      await expect(await aerodromeAmoStrategy.checkBalance(weth.address)).to.approxEqualTolerance(oethUnits("24.98"));
      await mintAndDepositToStrategy({ amount: oethUnits("6") });
      await expect(await aerodromeAmoStrategy.checkBalance(weth.address)).to.approxEqualTolerance(oethUnits("30.98"));
      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), BigNumber.from("0"), true);

      await expect(await aerodromeAmoStrategy.checkBalance(weth.address)).to.approxEqualTolerance(oethUnits("54.9"));
    });

    it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
      // swap out most of the weth
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("4.99"),
        swapWeth: false
      });

      await expect(
        rebalance(oethUnits("4.99"), oethUnits("4"), true)
      ).to.be.revertedWith("NotEnoughWethForSwap");
    });
  });

  const setup = async () => {
    await mintAndDepositToStrategy({ amount: oethUnits("5") });

    // move the price to pre-configured 20% value
    await rebalance(
      oethUnits("0.0027"),
      oethUnits("0.0026"),
      true // _swapWETH
    );
  }

  // const printPoolInfo = async () => {
  //   const [amountWETH, amountOETHb] = await aerodromeAmoStrategy.getPositionPrincipal();
  //   const poolPrice = Number((await aerodromeAmoStrategy.getPoolX96Price()).toString());
  //   const priceTick0 = Number((await aerodromeAmoStrategy.sqrtRatioX96Tick0()).toString());
  //   const priceTick1 = Number((await aerodromeAmoStrategy.sqrtRatioX96Tick1()).toString());

  //   let displayedPoolPrice = '';
  //   if (poolPrice > priceTick1) {
  //     displayedPoolPrice = 'smaller than 1.0000';
  //   } else if (poolPrice > priceTick0) {
  //     const tickPriceWidth = priceTick1 - priceTick0;
  //     const tickPosition = poolPrice - priceTick0;
  //     console.log("POSITION WITHIN TICK");
  //     console.log("tickPriceWidth", tickPriceWidth);
  //     console.log("tickPosition", tickPosition);
  //     const relativePosition = tickPosition / tickPriceWidth;
  //     const displayedPoolPrice = `${1 + 0.0001 * relativePosition}`;
  //   } else {
  //     displayedPoolPrice = 'greater than 1.0001';
  //   }

  //   console.log("--------- AERODROME POOL LP POSITION ---------");
  //   console.log("WETH amount      : ", formatUnits(amountWETH));
  //   console.log("OETHb amount     : ", formatUnits(amountOETHb));
  //   console.log("price of OETHb   : ", displayedPoolPrice);
  // };

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

  const rebalance = async (amountToSwap, minTokenReceived, swapWETH) => {
    return await aerodromeAmoStrategy
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
