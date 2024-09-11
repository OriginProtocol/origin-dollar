const hre = require("hardhat");
const { createFixtureLoader } = require("../_fixture");

const addresses = require("../../utils/addresses");
const { defaultBaseFixture } = require("../_fixture-base");
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
    quoter = fixture.quoter;

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

  it("Should be reverted trying to rebalance and we are not in the correct tick", async () => {
    // Push price to tick 0, which is OutisdeExpectedTickRange
    const { value, direction } = await quoteAmountToSwapToReachPrice(
      await aerodromeAmoStrategy.sqrtRatioX96TickHigher()
    );
    await swap({ amount: value, swapWeth: direction });

    await expect(
      aerodromeAmoStrategy
        .connect(strategist)
        .rebalance(oethUnits("0"), false, oethUnits("0"))
    ).to.be.revertedWith("OutsideExpectedTickRange");
  });

  const setupEmpty = async () => {
    const poolDeployer = await impersonateAndFund(
      "0xFD9E6005187F448957a0972a7d0C0A6dA2911236"
    );
    const deadSigner = await impersonateAndFund(
      "0x000000000000000000000000000000000000dead"
    );

    // remove all existing liquidity from the pool
    const { liquidity } = await aeroNftManager
      .connect(poolDeployer)
      .positions(342186);

    await aeroNftManager.connect(poolDeployer).decreaseLiquidity({
      tokenId: 342186,
      liquidity: liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: futureEpoch,
    });

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

  const quoteAmountToSwapToReachPrice = async (price) => {
    const txResponse = await quoter.quoteAmountToSwapToReachPrice(price);
    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;
    const priceReached = transferEvent.args.sqrtPriceAfterX96;
    return { value, direction, priceReached };
  };

  const swap = async ({ amount, swapWeth }) => {
    // Check if rafael as enough token to perfom swap
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
      sqrtPriceLimitX96: swapWeth
        ? sqrtRatioX96TickM1000
        : sqrtRatioX96Tick1000,
    });
  };
});

describe("ForkTest: Aerodrome AMO Strategy (Base)", function () {
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
    aeroSwapRouter,
    aeroNftManager,
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
    aeroSwapRouter = fixture.aeroSwapRouter;
    aeroNftManager = fixture.aeroNftManager;
    oethbVaultSigner = await impersonateAndFund(oethbVault.address);
    gauge = fixture.aeroClGauge;
    quoter = fixture.quoter;

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
      // correct pool weth share interval
      expect(await aerodromeAmoStrategy.allowedWethShareStart()).to.equal(
        oethUnits("0.18")
      );

      expect(await aerodromeAmoStrategy.allowedWethShareEnd()).to.equal(
        oethUnits("0.22")
      );

      // correct harvester set
      expect(await aerodromeAmoStrategy.harvesterAddress()).to.equal(
        await strategist.getAddress()
      );

      await assetLpStakedInGauge();
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

      await aerodromeAmoStrategy.connect(governor).safeApproveAllTokens();
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
      const { governor, aerodromeAmoStrategy } = fixture;

      await aerodromeAmoStrategy
        .connect(governor)
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
      const { governor, aerodromeAmoStrategy } = fixture;

      await expect(
        aerodromeAmoStrategy
          .connect(governor)
          .setAllowedPoolWethShareInterval(oethUnits("0.5"), oethUnits("0.4"))
      ).to.be.revertedWith("Invalid interval");

      await expect(
        aerodromeAmoStrategy
          .connect(governor)
          .setAllowedPoolWethShareInterval(
            oethUnits("0.0001"),
            oethUnits("0.5")
          )
      ).to.be.revertedWith("Invalid interval start");

      await expect(
        aerodromeAmoStrategy
          .connect(governor)
          .setAllowedPoolWethShareInterval(oethUnits("0.2"), oethUnits("0.96"))
      ).to.be.revertedWith("Invalid interval end");
    });
  });

  describe("Harvest rewards", function () {
    it("Should be able to collect reward tokens", async () => {
      const strategistAddr = await strategist.getAddress();

      await setERC20TokenBalance(
        aerodromeAmoStrategy.address,
        aero,
        "1337",
        hre
      );
      const aeroBalanceBefore = await aero.balanceOf(strategistAddr);
      await aerodromeAmoStrategy.connect(strategist).collectRewardTokens();

      const aeroBalancediff = (await aero.balanceOf(strategistAddr)).sub(
        aeroBalanceBefore
      );

      expect(aeroBalancediff).to.gte(oethUnits("1337")); // Gte to take into account rewards already accumulated.
      await assetLpStakedInGauge();
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

      // Little to no weth should be left on the strategy contract - 1000 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await assetLpStakedInGauge();
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

      // Little to no weth should be left on the strategy contract - 1000 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await assetLpStakedInGauge();
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

      await assetLpNOTStakedInGauge();
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

      // Little to no weth should be left on the strategy contract - 1000 wei is really small
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await assetLpStakedInGauge();
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

      await assetLpNOTStakedInGauge();
    });
  });

  describe("Deposit and rebalance", function () {
    it("Should be able to deposit to the strategy", async () => {
      await mintAndDepositToStrategy();
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

      const { value, direction } = await quoteAmountToSwapBeforeRebalance();
      const tx = await rebalance(value, direction, value.mul("99").div("100"));

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await assetLpStakedInGauge();
    });

    it("Should be able to deposit to the pool & rebalance multiple times", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance();
      const tx = await rebalance(value, direction, value.mul("99").div("100"));

      await expect(tx).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await assetLpStakedInGauge();

      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx1 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );

      await expect(tx1).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await assetLpStakedInGauge();
    });

    it("Should check that add liquidity in difference cases leaves no to little weth on the contract", async () => {
      const amount = oethUnits("5");

      weth.connect(rafael).approve(oethbVault.address, amount);
      await oethbVault.connect(rafael).mint(weth.address, amount, amount);
      expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(
        oethUnits("0")
      );

      await oethbVault
        .connect(governor)
        .depositToStrategy(
          aerodromeAmoStrategy.address,
          [weth.address],
          [amount]
        );
      await expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(
        amount
      );

      await expect(
        aerodromeAmoStrategy
          .connect(strategist)
          .rebalance(oethUnits("0"), false, oethUnits("0"))
      );

      await expect(await weth.balanceOf(aerodromeAmoStrategy.address)).to.equal(
        oethUnits("0")
      );

      await assetLpStakedInGauge();
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
      ).to.be.revertedWith("NotEnoughWethForSwap");
    });

    it("Should revert when pool rebalance is off target", async () => {
      const { value, direction } = await quoteAmountToSwapBeforeRebalance();

      await expect(
        rebalance(value.mul("200").div("100"), direction, 0)
      ).to.be.revertedWith("PoolRebalanceOutOfBounds");
    });

    it("Should be able to rebalance the pool when price pushed to 1:1", async () => {
      const priceAtTick0 = await aerodromeAmoStrategy.sqrtRatioX96TickHigher();
      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice(priceAtTick0);
      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      // supply some WETH for the rebalance
      await mintAndDepositToStrategy({ amount: oethUnits("1") });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance();
      await rebalance(value, direction, value.mul("99").div("100"));

      await assetLpStakedInGauge();
    });

    it("Should be able to rebalance the pool when price pushed to close to 1 OETHb costing 1.0001 WETH", async () => {
      const priceAtTickLower =
        await aerodromeAmoStrategy.sqrtRatioX96TickLower();
      let { value: value0, direction: direction0 } =
        await quoteAmountToSwapToReachPrice(priceAtTickLower);
      await swap({
        amount: value0,
        swapWeth: direction0,
      });

      const { value, direction } = await quoteAmountToSwapBeforeRebalance();
      await rebalance(value, direction, value.mul("99").div("100"));

      await assetLpStakedInGauge();
    });

    it("Should have the correct balance within some tolerance", async () => {
      const balance = await aerodromeAmoStrategy.checkBalance(weth.address);
      await mintAndDepositToStrategy({ amount: oethUnits("6") });
      await expect(
        await aerodromeAmoStrategy.checkBalance(weth.address)
      ).to.equal(balance.add(oethUnits("6")));

      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), true, BigNumber.from("0"));

      await expect(
        await aerodromeAmoStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(balance.add(oethUnits("6").mul("4")), 1.5);

      await assetLpStakedInGauge();
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
      ).to.be.revertedWith("NotEnoughWethForSwap");

      await assetLpStakedInGauge();
    });

    it("Should not be able to rebalance when protocol is insolvent", async () => {
      const stratSigner = await impersonateAndFund(
        aerodromeAmoStrategy.address
      );

      await mintAndDepositToStrategy({ amount: oethUnits("10") });
      // transfer WETH out making the protocol insolvent
      const bal = await weth.balanceOf(aerodromeAmoStrategy.address);
      await weth.connect(stratSigner).transfer(addresses.dead, bal);

      await expect(
        rebalance(
          oethUnits("0.00001"),
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
      await assetLpStakedInGauge();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx1 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx1).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await assetLpStakedInGauge();

      // Withdraw from the pool
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));
      await assetLpStakedInGauge();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx2 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx2).to.emit(aerodromeAmoStrategy, "PoolRebalanced");
      await assetLpStakedInGauge();

      // Withdraw from the pool
      await aerodromeAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));
      await assetLpStakedInGauge();

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
      await assetLpStakedInGauge();
    });
  });

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
    await mintAndDepositToStrategy({ amount: oethUnits("5") });

    const { value, direction } = await quoteAmountToSwapBeforeRebalance();

    // move the price to pre-configured 20% value
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

  const quoteAmountToSwapToReachPrice = async (price) => {
    const txResponse = await quoter.quoteAmountToSwapToReachPrice(price);
    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;
    const priceReached = transferEvent.args.sqrtPriceAfterX96;
    return { value, direction, priceReached };
  };

  const swap = async ({ amount, swapWeth }) => {
    // Check if rafael as enough token to perfom swap
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

  const quoteAmountToSwapBeforeRebalance = async () => {
    // Get the strategist address
    const strategist = oethbVault.strategistAddr();

    // Set Quoter as strategist to pass the `onlyGovernorOrStrategist` requirement
    await oethbVault
      .connect(await impersonateAndFund(addresses.base.governor))
      .setStrategistAddr(await quoter.quoterHelper());

    // Get the quote
    const txResponse = await quoter["quoteAmountToSwapBeforeRebalance()"]();
    const txReceipt = await txResponse.wait();
    const [transferEvent] = txReceipt.events;
    const value = transferEvent.args.value;
    const direction = transferEvent.args.swapWETHForOETHB;

    // Set back the original strategist
    await oethbVault
      .connect(await impersonateAndFund(addresses.base.governor))
      .setStrategistAddr(strategist);

    // Return the value and direction
    return { value, direction };
  };

  const rebalance = async (amountToSwap, swapWETH, minTokenReceived) => {
    return await aerodromeAmoStrategy
      .connect(strategist)
      .rebalance(amountToSwap, swapWETH, minTokenReceived);
  };

  const mintAndDepositToStrategy = async ({ userOverride, amount } = {}) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    await oethbVault.connect(user).mint(weth.address, amount, amount);

    await oethbVault
      .connect(governor)
      .depositToStrategy(
        aerodromeAmoStrategy.address,
        [weth.address],
        [amount]
      );
  };
});
