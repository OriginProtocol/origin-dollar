const hre = require("hardhat");
const {
  createFixtureLoader,
  nodeRevert,
  nodeSnapshot,
} = require("../../_fixture");

const addresses = require("../../../utils/addresses");
const {
  defaultBaseFixture,
  baseFixtureWithMockedVaultAdmin,
} = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const ethers = require("ethers");
const { impersonateAndFund } = require("../../../utils/signers");
//const { formatUnits } = ethers.utils;
const { BigNumber } = ethers;

const baseFixture = createFixtureLoader(defaultBaseFixture);
const baseFixtureWithMockedVault = createFixtureLoader(
  baseFixtureWithMockedVaultAdmin
);
const { setERC20TokenBalance } = require("../../_fund");
const futureEpoch = 1924064072;

describe("Base Fork Test: Aerodrome AMO Strategy empty pool setup (Base)", async function () {
  let fixture,
    oethbVault,
    oethb,
    weth,
    aerodromeAmoStrategy,
    governor,
    strategist,
    rafael,
    aeroSwapRouter,
    aeroNftManager,
    sugar,
    quoter;

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
    sugar = fixture.sugar;
    quoter = fixture.quoter;

    await setupEmpty();

    await weth
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000000000"));
    await oethb
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000000000"));
  });

  // tests need liquidity outside AMO ticks in order to test for fail states
  const depositLiquidityToPool = async () => {
    await weth
      .connect(rafael)
      .approve(aeroNftManager.address, oethUnits("1000000000"));
    await oethb
      .connect(rafael)
      .approve(aeroNftManager.address, oethUnits("1000000000"));

    let blockTimestamp = (await hre.ethers.provider.getBlock("latest"))
      .timestamp;

    await weth.connect(rafael).approve(oethbVault.address, oethUnits("200"));
    await oethbVault
      .connect(rafael)
      .mint(weth.address, oethUnits("200"), oethUnits("199.999"));

    // we need to supply liquidity in 2 separate transactions so liquidity position is populated
    // outside the active tick.
    await aeroNftManager.connect(rafael).mint({
      token0: weth.address,
      token1: oethb.address,
      tickSpacing: BigNumber.from("1"),
      tickLower: -3,
      tickUpper: -1,
      amount0Desired: oethUnits("100"),
      amount1Desired: oethUnits("100"),
      amount0Min: BigNumber.from("0"),
      amount1Min: BigNumber.from("0"),
      recipient: rafael.address,
      deadline: blockTimestamp + 2000,
      sqrtPriceX96: BigNumber.from("0"),
    });

    await aeroNftManager.connect(rafael).mint({
      token0: weth.address,
      token1: oethb.address,
      tickSpacing: BigNumber.from("1"),
      tickLower: 0,
      tickUpper: 3,
      amount0Desired: oethUnits("100"),
      amount1Desired: oethUnits("100"),
      amount0Min: BigNumber.from("0"),
      amount1Min: BigNumber.from("0"),
      recipient: rafael.address,
      deadline: blockTimestamp + 2000,
      sqrtPriceX96: BigNumber.from("0"),
    });
  };

  // Haven't found a way to test for this in the strategy contract yet
  it.skip("Revert when there is no token id yet and no liquidity to perform the swap.", async () => {
    const amount = oethUnits("5");
    await oethbVault.connect(rafael).mint(weth.address, amount, amount);

    await oethbVault
      .connect(governor)
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [amount]
      );

    await expect(
      aerodromeAmoStrategy
        .connect(strategist)
        .rebalance(oethUnits("0.001"), false, oethUnits("0.0008"))
    ).to.be.revertedWith("Can not rebalance empty pool");
  });

  it.skip("Should be reverted trying to rebalance and we are not in the correct tick, below", async () => {
    await depositLiquidityToPool();

    // Push price to tick -2, which is OutsideExpectedTickRange
    const priceAtTickM2 = await sugar.getSqrtRatioAtTick(-2);
    const { value, direction } = await quoteAmountToSwapToReachPrice({
      price: priceAtTickM2,
    });

    await swap({
      amount: value,
      swapWeth: direction,
      priceLimit: priceAtTickM2,
    });

    // Ensure the price has been pushed enough
    expect(
      await aerodromeAmoStrategy.getPoolX96Price()
    ).to.be.approxEqualTolerance(priceAtTickM2);

    await expect(
      aerodromeAmoStrategy
        .connect(strategist)
        .rebalance(oethUnits("0"), direction, oethUnits("0"))
    ).to.be.revertedWithCustomError("OutsideExpectedTickRange(int24)");
  });

  it("Should be reverted trying to rebalance and we are not in the correct tick, above", async () => {
    await depositLiquidityToPool();
    // Push price to tick 1, which is OutsideExpectedTickRange
    const priceAtTick1 = await sugar.getSqrtRatioAtTick(1);
    const { value, direction } = await quoteAmountToSwapToReachPrice({
      price: priceAtTick1,
    });
    await swap({
      amount: value,
      swapWeth: direction,
      priceLimit: priceAtTick1,
    });

    // Ensure the price has been pushed enough
    expect(
      await aerodromeAmoStrategy.getPoolX96Price()
    ).to.be.approxEqualTolerance(priceAtTick1);

    await expect(
      aerodromeAmoStrategy
        .connect(strategist)
        .rebalance(oethUnits("0"), direction, oethUnits("0"))
    ).to.be.revertedWithCustomError("OutsideExpectedTickRange(int24)");
  });

  const setupEmpty = async () => {
    const deadSigner = await impersonateAndFund(
      "0x000000000000000000000000000000000000dead"
    );

    const positionInfo = await aeroNftManager
      .connect(deadSigner)
      .positions(413296);

    await aeroNftManager.connect(deadSigner).decreaseLiquidity({
      tokenId: 413296,
      liquidity: positionInfo.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: futureEpoch,
    });
  };

  const quoteAmountToSwapToReachPrice = async ({ price }) => {
    let txResponse = await quoter["quoteAmountToSwapToReachPrice(uint160)"](
      price
    );

    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;
    const priceReached = transferEvent.args.sqrtPriceAfterX96;
    return { value, direction, priceReached };
  };

  const swap = async ({ amount, swapWeth, priceLimit }) => {
    // Check if rafael as enough token to perform swap
    // If not, mint some
    const balanceOETHb = await oethb.balanceOf(rafael.address);
    if (!swapWeth && balanceOETHb.lt(amount)) {
      await weth.connect(rafael).approve(oethbVault.address, amount);
      await oethbVault.connect(rafael).mint(weth.address, amount, amount);
    }

    const sqrtRatioX96Tick1000 = BigNumber.from(
      "83290069058676223003182343270"
    );
    const sqrtRatioX96TickM1000 = BigNumber.from(
      "75364347830767020784054125655"
    );
    await aeroSwapRouter.connect(rafael).exactInputSingle({
      tokenIn: swapWeth ? weth.address : oethb.address,
      tokenOut: swapWeth ? oethb.address : weth.address,
      tickSpacing: 1,
      recipient: rafael.address,
      deadline: 9999999999,
      amountIn: amount,
      amountOutMinimum: 0, // slippage check
      sqrtPriceLimitX96:
        priceLimit == 0
          ? swapWeth
            ? sqrtRatioX96TickM1000
            : sqrtRatioX96Tick1000
          : priceLimit,
    });
  };
});

describe("ForkTest: Aerodrome AMO Strategy (Base)", async function () {
  let fixture,
    gauge,
    oethbVault,
    oethbVaultSigner,
    oethb,
    aero,
    weth,
    aerodromeAmoStrategy,
    governor,
    strategist,
    rafael,
    nick,
    aeroSwapRouter,
    aeroNftManager,
    harvester,
    quoter;

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
    nick = fixture.nick;
    aeroSwapRouter = fixture.aeroSwapRouter;
    aeroNftManager = fixture.aeroNftManager;
    oethbVaultSigner = await impersonateAndFund(oethbVault.address);
    gauge = fixture.aeroClGauge;
    harvester = fixture.harvester;
    quoter = fixture.quoter;

    await setup();
    await weth
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000000000"));
    await oethb
      .connect(rafael)
      .approve(aeroSwapRouter.address, oethUnits("1000000000"));
  });

  const configureAutomaticDepositOnMint = async (vaultBuffer) => {
    await oethbVault.connect(governor).setVaultBuffer(vaultBuffer);

    const totalValue = await oethbVault.totalValue();

    // min mint to trigger deposits
    return totalValue.mul(vaultBuffer).div(oethUnits("1"));
  };

  // tests need liquidity outside AMO ticks in order to test for fail states
  const depositLiquidityToPool = async () => {
    await weth
      .connect(rafael)
      .approve(aeroNftManager.address, oethUnits("1000000000"));
    await oethb
      .connect(rafael)
      .approve(aeroNftManager.address, oethUnits("1000000000"));

    let blockTimestamp = (await hre.ethers.provider.getBlock("latest"))
      .timestamp;

    await weth.connect(rafael).approve(oethbVault.address, oethUnits("200"));
    await oethbVault
      .connect(rafael)
      .mint(weth.address, oethUnits("200"), oethUnits("199.999"));

    // we need to supply liquidity in 2 separate transactions so liquidity position is populated
    // outside the active tick.
    await aeroNftManager.connect(rafael).mint({
      token0: weth.address,
      token1: oethb.address,
      tickSpacing: BigNumber.from("1"),
      tickLower: -3,
      tickUpper: -1,
      amount0Desired: oethUnits("100"),
      amount1Desired: oethUnits("100"),
      amount0Min: BigNumber.from("0"),
      amount1Min: BigNumber.from("0"),
      recipient: rafael.address,
      deadline: blockTimestamp + 2000,
      sqrtPriceX96: BigNumber.from("0"),
    });

    await aeroNftManager.connect(rafael).mint({
      token0: weth.address,
      token1: oethb.address,
      tickSpacing: BigNumber.from("1"),
      tickLower: 0,
      tickUpper: 3,
      amount0Desired: oethUnits("100"),
      amount1Desired: oethUnits("100"),
      amount0Min: BigNumber.from("0"),
      amount1Min: BigNumber.from("0"),
      recipient: rafael.address,
      deadline: blockTimestamp + 2000,
      sqrtPriceX96: BigNumber.from("0"),
    });
  };

  describe("ForkTest: Initial state (Base)", function () {
    it("Should have the correct initial state", async function () {
      // correct pool weth share interval
      expect(await aerodromeAmoStrategy.allowedWethShareStart()).to.equal(
        oethUnits("0.010000001")
      );

      expect(await aerodromeAmoStrategy.allowedWethShareEnd()).to.equal(
        oethUnits("0.15")
      );

      // correct harvester set
      expect(await aerodromeAmoStrategy.harvesterAddress()).to.equal(
        harvester.address
      );

      await verifyEndConditions();
    });

    it("Can safe approve all tokens", async function () {
      const aerodromeSigner = await impersonateAndFund(
        aerodromeAmoStrategy.address
      );
      await weth
        .connect(aerodromeSigner)
        .approve(aeroNftManager.address, BigNumber.from("0"));
      await oethb
        .connect(aerodromeSigner)
        .approve(aeroNftManager.address, BigNumber.from("0"));

      await weth
        .connect(aerodromeSigner)
        .approve(aeroSwapRouter.address, BigNumber.from("0"));
      await oethb
        .connect(aerodromeSigner)
        .approve(aeroSwapRouter.address, BigNumber.from("0"));

      const gov = await aerodromeAmoStrategy.governor();
      await aerodromeAmoStrategy
        .connect(await impersonateAndFund(gov))
        .safeApproveAllTokens();
    });

    it("Should revert setting ptoken address", async function () {
      await expect(
        aerodromeAmoStrategy
          .connect(governor)
          .setPTokenAddress(weth.address, aero.address)
      ).to.be.revertedWith("Unsupported method");
    });

    it("Should revert setting ptoken address", async function () {
      await expect(
        aerodromeAmoStrategy.connect(governor).removePToken(weth.address)
      ).to.be.revertedWith("Unsupported method");
    });
  });

  describe("Configuration", function () {
    it("Governor can set the allowed pool weth share interval", async () => {
      const { aerodromeAmoStrategy } = fixture;
      const gov = await aerodromeAmoStrategy.governor();

      await aerodromeAmoStrategy
        .connect(await impersonateAndFund(gov))
        .setAllowedPoolWethShareInterval(oethUnits("0.19"), oethUnits("0.23"));

      expect(await aerodromeAmoStrategy.allowedWethShareStart()).to.equal(
        oethUnits("0.19")
      );

      expect(await aerodromeAmoStrategy.allowedWethShareEnd()).to.equal(
        oethUnits("0.23")
      );
    });

    it("Only the governor can set the pool weth share", async () => {
      const { rafael, aerodromeAmoStrategy } = fixture;

      await expect(
        aerodromeAmoStrategy
          .connect(rafael)
          .setAllowedPoolWethShareInterval(oethUnits("0.19"), oethUnits("0.23"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not set incorrect pool WETH share intervals", async () => {
      const { aerodromeAmoStrategy } = fixture;
      const gov = await aerodromeAmoStrategy.governor();

      await expect(
        aerodromeAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(oethUnits("0.5"), oethUnits("0.4"))
      ).to.be.revertedWith("Invalid interval");

      await expect(
        aerodromeAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(
            oethUnits("0.0001"),
            oethUnits("0.5")
          )
      ).to.be.revertedWith("Invalid interval start");

      await expect(
        aerodromeAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(oethUnits("0.2"), oethUnits("0.96"))
      ).to.be.revertedWith("Invalid interval end");
    });
  });

  describe("Harvest rewards", function () {
    it("Should be able to collect reward tokens", async () => {
      await setERC20TokenBalance(
        aerodromeAmoStrategy.address,
        aero,
        "1337",
        hre
      );
      const aeroBalanceBefore = await aero.balanceOf(strategist.address);

      // prettier-ignore
      await harvester.connect(strategist)["harvestAndTransfer(address)"](aerodromeAmoStrategy.address);

      const aeroBalanceDiff = (await aero.balanceOf(strategist.address)).sub(
        aeroBalanceBefore
      );

      expect(aeroBalanceDiff).to.gte(oethUnits("1337")); // Gte to take into account rewards already accumulated.
      await verifyEndConditions();
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdraw when the pool is 80:20 balanced", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      const balanceBefore = await weth.balanceOf(oethbVault.address);

      const poolPrice = await aerodromeAmoStrategy.getPoolX96Price();

      // setup() moves the pool closer to 80:20
      const [amountWETH, amountOETHb] =
        await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));

      // Make sure that 1 WETH and 4 OETHb were burned
      const [amountWETHAfter, amountOETHbAfter] =
        await aerodromeAmoStrategy.getPositionPrincipal();

      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("1"))
      );

      expect(amountOETHbAfter).to.approxEqualTolerance(
        amountOETHb.sub(oethUnits("4")),
        3
      );

      // Make sure there's no price movement
      expect(await aerodromeAmoStrategy.getPoolX96Price()).to.eq(poolPrice);

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.eq(
        balanceBefore.add(oethUnits("1"))
      );

      // There may remain some WETH left on the strategy contract because:
      // When calculating `shareOfWetToRemove` on `withdraw` function in `AerodromeAMOStrategy.sol`, the result is rounded up.
      // This leads to a maximum of 1wei error of the `shareOfWetToRemove` value.
      // Then this value is multiplied by the `_getLiquidity()` value which multiplies the previous error.
      // The value of `_getLiquidity()` is expressed in ethers, for example at block 19670000 it was approx 18_000_000 ethers.
      // This leads to a maximum of 18_000_000 wei error in this situation (due to `mulTruncate()` function).
      // At the end, the bigger the `_getLiquidity()` value the bigger the error.
      // However, during test the error values remains most of the time below 1e6wei.
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000000")
      );

      await verifyEndConditions();
    });

    it("Should allow withdrawAll when the pool is 80:20 balanced", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth, oethb } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      const balanceBefore = await weth.balanceOf(oethbVault.address);
      const supplyBefore = await oethb.totalSupply();

      // setup() moves the pool closer to 80:20
      const [amountWETHBefore, amountOETHbBefore] =
        await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // // Make sure pool is empty
      const [amountWETH, amountOETHb] =
        await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountOETHb).to.eq(0);
      expect(amountWETH).to.eq(0);

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETHBefore)
      );

      // And supply has gone down
      expect(await oethb.totalSupply()).to.eq(
        supplyBefore.sub(amountOETHbBefore)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(
        oethUnits("0")
      );

      await assetLpNOTStakedInGauge();
    });

    it("Should withdraw when there's little WETH in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false,
      });

      const balanceBefore = await weth.balanceOf(oethbVault.address);

      const [amountWETH, amountOETHb] =
        await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));

      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] =
        await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("1"))
      );
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(
        amountOETHb.div(amountWETH)
      );

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceBefore.add(oethUnits("1"))
      );

      // There may remain some WETH left on the strategy contract because:
      // When calculating `shareOfWetToRemove` on `withdraw` function in `AerodromeAMOStrategy.sol`, the result is rounded up.
      // This leads to a maximum of 1wei error of the `shareOfWetToRemove` value.
      // Then this value is multiplied by the `_getLiquidity()` value which multiplies the previous error.
      // The value of `_getLiquidity()` is expressed in ethers, for example at block 19670000 it was approx 18_000_000 ethers.
      // This leads to a maximum of 18_000_000 wei error in this situation (due to `mulTruncate()` function).
      // At the end, the bigger the `_getLiquidity()` value the bigger the error.
      // However, during test the error values remains most of the time below 1e6wei.
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000000")
      );

      await verifyEndConditions();
    });

    it("Should withdrawAll when there's little WETH in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false,
      });

      const balanceBefore = await weth.balanceOf(oethbVault.address);

      const [amountWETH] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETH)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(
        oethUnits("0")
      );

      await verifyEndConditions(false);
    });

    it("Should withdraw when there's little OETHb in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of OETHb
      await swap({
        // Pool has 5 OETHb
        amount: oethUnits("3.5"),
        swapWeth: true,
      });

      const balanceBefore = await weth.balanceOf(oethbVault.address);

      const [amountWETH, amountOETHb] =
        await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));

      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] =
        await aerodromeAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("1"))
      );
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(
        amountOETHb.div(amountWETH)
      );

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceBefore.add(oethUnits("1"))
      );

      // There may remain some WETH left on the strategy contract because:
      // When calculating `shareOfWetToRemove` on `withdraw` function in `AerodromeAMOStrategy.sol`, the result is rounded up.
      // This leads to a maximum of 1wei error of the `shareOfWetToRemove` value.
      // Then this value is multiplied by the `_getLiquidity()` value which multiplies the previous error.
      // The value of `_getLiquidity()` is expressed in ethers, for example at block 19670000 it was approx 18_000_000 ethers.
      // This leads to a maximum of 18_000_000 wei error in this situation (due to `mulTruncate()` function).
      // At the end, the bigger the `_getLiquidity()` value the bigger the error.
      // However, during test the error values remains most of the time below 1e6wei.
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000000")
      );

      await verifyEndConditions();
    });

    it("Should withdrawAll when there's little OETHb in the pool", async () => {
      const { oethbVault, aerodromeAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false,
      });

      const balanceBefore = await weth.balanceOf(oethbVault.address);

      const [amountWETH] = await aerodromeAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETH)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.eq(
        oethUnits("0")
      );

      await verifyEndConditions(false);
    });
  });

  describe("Deposit and rebalance", function () {
    it("Should be able to deposit to the strategy", async () => {
      await mintAndDepositToStrategy();

      await verifyEndConditions();
    });

    it("Should revert when not depositing WETH or amount is 0", async () => {
      await expect(
        aerodromeAmoStrategy
          .connect(oethbVaultSigner)
          .deposit(aero.address, BigNumber.from("1"))
      ).to.be.revertedWith("Unsupported asset");

      await expect(
        aerodromeAmoStrategy
          .connect(oethbVaultSigner)
          .deposit(weth.address, BigNumber.from("0"))
      ).to.be.revertedWith("Must deposit something");
    });

    it("Should be able to deposit to the pool & rebalance", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0"),
        highValue: oethUnits("0"),
      });
      const tx = await rebalance(value, direction, value.mul("99").div("100"));

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });

    it("Should be able to deposit to the pool & rebalance multiple times", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0"),
        highValue: oethUnits("0"),
      });
      const tx = await rebalance(value, direction, value.mul("99").div("100"));

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx1 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );

      await expect(tx1).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });

    it("Should check that add liquidity in difference cases leaves no to little weth on the contract", async () => {
      const amount = oethUnits("5");

      weth.connect(rafael).approve(oethbVault.address, amount);
      await oethbVault.connect(rafael).mint(weth.address, amount, amount);

      const gov = await aerodromeAmoStrategy.governor();
      await oethbVault
        .connect(await impersonateAndFund(gov))
        .depositToStrategy(
          aerodromeAmoStrategy.address,
          [weth.address],
          [amount]
        );

      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        oethUnits("0")
      );

      await verifyEndConditions();
    });

    it("Should revert when there is not enough WETH to perform a swap", async () => {
      await swap({
        amount: oethUnits("5"),
        swapWeth: false,
      });

      await expect(
        rebalance(
          oethUnits("1000000000"),
          true, // _swapWETH
          oethUnits("0.009")
        )
      ).to.be.revertedWithCustomError(
        "NotEnoughWethLiquidity(uint256,uint256)"
      );
    });

    it("Should revert when pool rebalance is off target", async () => {
      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0.90"),
        highValue: oethUnits("0.92"),
      });

      await expect(
        rebalance(value, direction, 0)
      ).to.be.revertedWithCustomError(
        "PoolRebalanceOutOfBounds(uint256,uint256,uint256)"
      );
    });

    it("Should be able to rebalance the pool when price pushed very close to 1:1", async () => {
      await depositLiquidityToPool();

      // supply some WETH for the rebalance
      await mintAndDepositToStrategy({ amount: oethUnits("1") });

      const priceAtTickLower =
        await aerodromeAmoStrategy.sqrtRatioX96TickLower();
      const priceAtTickHigher =
        await aerodromeAmoStrategy.sqrtRatioX96TickHigher();
      const pctTickerPrice = priceAtTickHigher.sub(priceAtTickLower).div(100);

      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice({
          price: priceAtTickHigher.sub(pctTickerPrice),
        });

      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0"),
        highValue: oethUnits("0"),
      });

      await rebalance(value, direction, value.mul("99").div("100"));

      await verifyEndConditions();
    });

    it("Should be able to rebalance the pool when price pushed to over the 1 OETHb costing 1.0001 WETH", async () => {
      const priceAtTickLower =
        await aerodromeAmoStrategy.sqrtRatioX96TickLower();
      const priceAtTickHigher =
        await aerodromeAmoStrategy.sqrtRatioX96TickHigher();
      // 5% of the price diff within a single ticker
      const twentyPctTickerPrice = priceAtTickHigher
        .sub(priceAtTickLower)
        .div(20);

      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice({
          price: priceAtTickLower.add(twentyPctTickerPrice),
        });
      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0"),
        highValue: oethUnits("0"),
      });
      await rebalance(value, direction, value.mul("99").div("100"));

      await verifyEndConditions();
    });

    it("Should be able to rebalance the pool when price pushed to close to the 1 OETHb costing 1.0001 WETH", async () => {
      const priceAtTickLower =
        await aerodromeAmoStrategy.sqrtRatioX96TickLower();
      const priceAtTickHigher =
        await aerodromeAmoStrategy.sqrtRatioX96TickHigher();
      // 5% of the price diff within a single ticker
      const fivePctTickerPrice = priceAtTickHigher
        .sub(priceAtTickLower)
        .div(20);

      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice({
          price: priceAtTickLower.sub(fivePctTickerPrice),
        });

      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance({
        lowValue: oethUnits("0"),
        highValue: oethUnits("0"),
      });
      await rebalance(value, direction, value.mul("99").div("100"));

      await verifyEndConditions();
    });

    it("Should have the correct balance within some tolerance", async () => {
      const balance = await aerodromeAmoStrategy.checkBalance(weth.address);
      await mintAndDepositToStrategy({ amount: oethUnits("6") });

      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), true, BigNumber.from("0"));

      await expect(
        await aerodromeAmoStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(balance.add(oethUnits("6").mul("4")), 1.5);

      await verifyEndConditions();
    });

    it("Should revert on non WETH balance", async () => {
      await expect(
        aerodromeAmoStrategy.checkBalance(aero.address)
      ).to.be.revertedWith("Only WETH supported");
    });

    it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
      // swap out most of the weth
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("4.99"),
        swapWeth: false,
      });

      await expect(
        rebalance(
          (await weth.balanceOf(await aerodromeAmoStrategy.clPool())).mul("2"),
          true,
          oethUnits("4")
        )
      ).to.be.revertedWithCustomError(
        "NotEnoughWethLiquidity(uint256,uint256)"
      );

      await verifyEndConditions();
    });

    it("Should not be able to rebalance when protocol is insolvent", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("1000") });
      await aerodromeAmoStrategy.connect(oethbVaultSigner).withdrawAll();

      // ensure there is a LP position
      await mintAndDepositToStrategy({ amount: oethUnits("1") });

      // transfer WETH out making the protocol insolvent
      const swapBal = oethUnits("0.00001");
      const addLiquidityBal = oethUnits("1");
      const balRemaining = (await weth.balanceOf(oethbVault.address))
        .sub(swapBal)
        .sub(addLiquidityBal);

      await weth
        .connect(oethbVaultSigner)
        .transfer(aerodromeAmoStrategy.address, swapBal.add(addLiquidityBal));
      await weth
        .connect(oethbVaultSigner)
        .transfer(addresses.dead, balRemaining);

      await expect(
        rebalance(
          swapBal,
          true, // _swapWETHs
          oethUnits("0.000009")
        )
      ).to.be.revertedWith("Protocol insolvent");

      await assetLpStakedInGauge();
    });
  });

  describe("Perform multiple actions", function () {
    it("LP token should stay staked with multiple deposit/withdraw actions", async () => {
      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      // deposit into pool once
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx = await rebalance(
        oethUnits("0.00001"),
        true, // _swapWETHs
        oethUnits("0.000009")
      );
      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx1 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx1).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // Withdraw from the pool
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));
      await verifyEndConditions();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx2 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx2).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // Withdraw from the pool
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));
      await verifyEndConditions();

      // Withdraw from the pool
      await aerodromeAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();
      await assetLpNOTStakedInGauge();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx3 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx3).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });
  });

  describe("Deposit and rebalance with mocked Vault", async () => {
    let fixture, oethbVault, oethb, weth, aerodromeAmoStrategy, rafael;

    beforeEach(async () => {
      fixture = await baseFixtureWithMockedVault();
      weth = fixture.weth;
      aero = fixture.aero;
      oethb = fixture.oethb;
      oethbVault = fixture.oethbVault;
      aerodromeAmoStrategy = fixture.aerodromeAmoStrategy;
      governor = fixture.governor;
      strategist = fixture.strategist;
      rafael = fixture.rafael;
      aeroSwapRouter = fixture.aeroSwapRouter;
      aeroNftManager = fixture.aeroNftManager;
      oethbVaultSigner = await impersonateAndFund(oethbVault.address);
      gauge = fixture.aeroClGauge;
      harvester = fixture.harvester;
      quoter = fixture.quoter;

      await setup();
      await weth
        .connect(rafael)
        .approve(aeroSwapRouter.address, oethUnits("1000000000"));
      await oethb
        .connect(rafael)
        .approve(aeroSwapRouter.address, oethUnits("1000000000"));
    });

    const depositAllVaultWeth = async ({ returnTransaction } = {}) => {
      const wethAvailable = await oethbVault.wethAvailable();
      const gov = await oethbVault.governor();
      const tx = await oethbVault
        .connect(await impersonateAndFund(gov))
        .depositToStrategy(
          aerodromeAmoStrategy.address,
          [weth.address],
          [wethAvailable]
        );

      if (returnTransaction) {
        return tx;
      }

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
    };

    const depositAllWethAndConfigure1Bp = async () => {
      // configure to leave no WETH on the vault
      await configureAutomaticDepositOnMint(oethUnits("0"));
      const outstandingWeth = await oethbVault.outstandingWithdrawalsAmount();

      // send WETH to the vault that is outstanding to be claimed
      await weth
        .connect(fixture.clement)
        .transfer(oethbVault.address, outstandingWeth);

      await depositAllVaultWeth();

      // configure to only keep 1bp of the Vault's totalValue in the Vault;
      const minAmountReserved = await configureAutomaticDepositOnMint(
        oethUnits("0.0001")
      );

      return minAmountReserved;
    };

    it("Should not automatically deposit to strategy when below vault buffer threshold", async () => {
      const minAmountReserved = await depositAllWethAndConfigure1Bp();

      const amountBelowThreshold = minAmountReserved.div(BigNumber.from("2"));

      await mint({ amount: amountBelowThreshold });
      await expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(
        oethUnits("0")
      );

      await expect(await oethbVault.wethAvailable()).to.approxEqualTolerance(
        amountBelowThreshold
      );

      await verifyEndConditions();
    });

    it("Should deposit amount above the vault buffer threshold to the strategy on mint", async () => {
      const minAmountReserved = await depositAllWethAndConfigure1Bp();

      const amountDoubleThreshold = minAmountReserved.mul(BigNumber.from("2"));

      await mint({ amount: amountDoubleThreshold });
      await expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(
        oethUnits("0")
      );
      // threshold amount should be left on the vault
      await expect(await oethbVault.wethAvailable()).to.approxEqualTolerance(
        minAmountReserved
      );

      await verifyEndConditions();
    });

    it("Should leave WETH on the contract when pool price outside allowed limits", async () => {
      const minAmountReserved = await depositAllWethAndConfigure1Bp();
      const amountDoubleThreshold = minAmountReserved.mul(BigNumber.from("2"));

      const priceAtTickLower =
        await aerodromeAmoStrategy.sqrtRatioX96TickLower();
      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice({
          price: priceAtTickLower,
        });

      // push price so 1 OETHb costs 1.0001 WETH
      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      await mint({ amount: amountDoubleThreshold });

      // roughly half of WETH should stay on the Aerodrome contract
      await expect(
        await weth.balanceOf(aerodromeAmoStrategy.address)
      ).to.approxEqualTolerance(minAmountReserved);
      // roughly half of WETH should stay on the Vault
      await expect(await oethbVault.wethAvailable()).to.approxEqualTolerance(
        minAmountReserved
      );

      await assetLpStakedInGauge();
    });
  });
  /** When tests finish:
   * - nft LP token should remain staked
   * - there should be no substantial amount of WETH / OETHb left on the strategy contract
   */
  const verifyEndConditions = async (lpStaked = true) => {
    if (lpStaked) {
      await assetLpStakedInGauge();
    } else {
      await assetLpNOTStakedInGauge();
    }

    await expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
      oethUnits("0.00001")
    );
    await expect(await oethb.balanceOf(aerodromeAmoStrategy.address)).to.equal(
      oethUnits("0")
    );
  };

  const assetLpStakedInGauge = async () => {
    const tokenId = await aerodromeAmoStrategy.tokenId();
    await expect(await aeroNftManager.ownerOf(tokenId)).to.equal(gauge.address);
  };

  const assetLpNOTStakedInGauge = async () => {
    const tokenId = await aerodromeAmoStrategy.tokenId();
    await expect(await aeroNftManager.ownerOf(tokenId)).to.equal(
      aerodromeAmoStrategy.address
    );
  };

  const setup = async () => {
    await mintAndDepositToStrategy({
      amount: oethUnits("5"),
      returnTransaction: true,
      depositALotBefore: false,
    });

    const { value, direction } = await quoteAmountToSwapBeforeRebalance({
      lowValue: oethUnits("0"),
      highValue: oethUnits("0"),
    });

    // move the price close to pre-configured 20% value
    await rebalance(
      value,
      direction, // _swapWETH
      0
    );
  };

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

  const quoteAmountToSwapToReachPrice = async ({ price }) => {
    let txResponse = await quoter.quoteAmountToSwapToReachPrice(price);
    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;
    const priceReached = transferEvent.args.sqrtPriceAfterX96;
    return { value, direction, priceReached };
  };

  const swap = async ({ amount, swapWeth }) => {
    // Check if rafael as enough token to perform swap
    // If not, mint some
    const balanceOETHb = await oethb.balanceOf(rafael.address);
    if (!swapWeth && balanceOETHb.lt(amount)) {
      await weth.connect(rafael).approve(oethbVault.address, amount);
      await oethbVault.connect(rafael).mint(weth.address, amount, amount);
      // Deal WETH and mint OETHb
    }

    const sqrtRatioX96Tick1000 = BigNumber.from(
      "83290069058676223003182343270"
    );
    const sqrtRatioX96TickM1000 = BigNumber.from(
      "75364347830767020784054125655"
    );
    await aeroSwapRouter.connect(rafael).exactInputSingle({
      tokenIn: swapWeth ? weth.address : oethb.address,
      tokenOut: swapWeth ? oethb.address : weth.address,
      tickSpacing: 1,
      recipient: rafael.address,
      deadline: 9999999999,
      amountIn: amount,
      amountOutMinimum: 0, // slippage check
      sqrtPriceLimitX96: swapWeth
        ? sqrtRatioX96TickM1000
        : sqrtRatioX96Tick1000,
    });
  };

  const quoteAmountToSwapBeforeRebalance = async ({ lowValue, highValue }) => {
    // create a snapshot so any changes in this function are reverted before
    // it returns.
    const snapshotId = await nodeSnapshot();

    // Set Quoter as strategist to pass the `onlyGovernorOrStrategist` requirement
    // Get governor
    const gov = await aerodromeAmoStrategy.governor();

    // Set pending governance to quoter helper
    await aerodromeAmoStrategy
      .connect(await impersonateAndFund(gov))
      .transferGovernance(await quoter.quoterHelper());
    // Quoter claim governance)
    await quoter.claimGovernance();

    let txResponse;
    if (lowValue == 0 && highValue == 0) {
      txResponse = await quoter["quoteAmountToSwapBeforeRebalance()"]();
    } else {
      txResponse = await quoter[
        "quoteAmountToSwapBeforeRebalance(uint256,uint256)"
      ](lowValue, highValue);
    }
    // Get the quote
    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;

    // Return the value and direction
    await nodeRevert(snapshotId);
    return { value, direction };
  };

  const rebalance = async (amountToSwap, swapWETH, minTokenReceived) => {
    return await aerodromeAmoStrategy
      .connect(strategist)
      .rebalance(amountToSwap, swapWETH, minTokenReceived);
  };

  const mint = async ({ userOverride, amount } = {}) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    const tx = await oethbVault
      .connect(user)
      .mint(weth.address, amount, amount);
    return tx;
  };

  const mintAndDepositToStrategy = async ({
    userOverride,
    amount,
    returnTransaction,
    depositALotBefore = false,
  } = {}) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");
    // Deposit a lot of WETH into the vault
    if (depositALotBefore) {
      const _amount = oethUnits("5000");
      await setERC20TokenBalance(nick.address, weth, _amount, hre);
      await weth.connect(nick).approve(oethbVault.address, _amount);
      await oethbVault.connect(nick).mint(weth.address, _amount, _amount);
    }

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    await oethbVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethbVault.governor();
    const tx = await oethbVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [amount]
      );

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
  };
});
