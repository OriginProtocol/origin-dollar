const { expect } = require("chai");
const {
  uniswapV3FixtureSetup,
  impersonateAndFundContract,
  defaultFixtureSetup,
} = require("../_fixture");
const {
  forkOnlyDescribe,
  units,
  ousdUnits,
  usdcUnitsFormat,
  usdtUnitsFormat,
  daiUnits,
  daiUnitsFormat,
  getBlockTimestamp,
} = require("../helpers");
const { BigNumber, utils } = require("ethers");

forkOnlyDescribe("Uniswap V3 Strategy", function () {
  after(async () => {
    // This is needed to revert fixtures
    // The other tests as of now don't use proper fixtures
    // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
    const f = defaultFixtureSetup();
    await f();
  });

  this.timeout(0);

  const uniswapV3Fixture = uniswapV3FixtureSetup();

  let fixture;
  let vault, ousd, usdc, usdt, dai;
  let reserveStrategy, strategy, pool, positionManager, v3Helper, swapRouter;
  let timelock;
  // governor,
  // strategist,
  // harvester
  let operator, josh, matt, daniel, domen, franck;

  beforeEach(async () => {
    fixture = await uniswapV3Fixture();
    reserveStrategy = fixture.morphoCompoundStrategy;
    strategy = fixture.UniV3_USDC_USDT_Strategy;
    pool = fixture.UniV3_USDC_USDT_Pool;
    positionManager = fixture.UniV3PositionManager;
    v3Helper = fixture.UniV3Helper;
    swapRouter = fixture.UniV3SwapRouter;

    ousd = fixture.ousd;
    usdc = fixture.usdc;
    usdt = fixture.usdt;
    dai = fixture.dai;
    vault = fixture.vault;
    // harvester = fixture.harvester;
    // governor = fixture.governor;
    // strategist = fixture.strategist;
    operator = fixture.operator;
    timelock = fixture.timelock;
    josh = fixture.josh;
    matt = fixture.matt;
    daniel = fixture.daniel;
    domen = fixture.domen;
    franck = fixture.franck;
  });

  async function setRebalancePriceThreshold(lowerTick, upperTick) {
    await strategy
      .connect(timelock)
      .setRebalancePriceThreshold(lowerTick, upperTick);
  }

  async function setMaxTVL(maxTvl) {
    await strategy.connect(timelock).setMaxTVL(utils.parseUnits(maxTvl, 18));
  }

  async function setMaxPositionValueLostThreshold(maxLossThreshold) {
    await strategy
      .connect(timelock)
      .setMaxPositionValueLostThreshold(utils.parseUnits(maxLossThreshold, 18));
  }

  describe("Uniswap V3 LP positions", function () {
    // NOTE: These tests all work on the assumption that the strategy
    // has no active position, which might not be true after deployment.
    // Gotta update the tests before that

    const findMaxDepositableAmount = async (
      lowerTick,
      upperTick,
      usdcAmount,
      usdtAmount
    ) => {
      const [sqrtRatioX96] = await pool.slot0();
      const sqrtRatioAX96 = await v3Helper.getSqrtRatioAtTick(lowerTick);
      const sqrtRatioBX96 = await v3Helper.getSqrtRatioAtTick(upperTick);

      const liquidity = await v3Helper.getLiquidityForAmounts(
        sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        usdcAmount,
        usdtAmount
      );

      const [maxAmount0, maxAmount1] = await v3Helper.getAmountsForLiquidity(
        sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        liquidity
      );

      return [maxAmount0, maxAmount1];
    };

    const mintLiquidity = async (
      lowerTick,
      upperTick,
      usdcAmount,
      usdtAmount
    ) => {
      const [maxUSDC, maxUSDT] = await findMaxDepositableAmount(
        lowerTick,
        upperTick,
        BigNumber.from(usdcAmount).mul(10 ** 6),
        BigNumber.from(usdtAmount).mul(10 ** 6)
      );

      const tx = await strategy
        .connect(operator)
        .rebalance(
          maxUSDC,
          maxUSDT,
          maxUSDC.mul(9900).div(10000),
          maxUSDT.mul(9900).div(10000),
          0,
          0,
          lowerTick,
          upperTick
        );

      const { events } = await tx.wait();

      const [tokenId, amount0Minted, amount1Minted, liquidityMinted] =
        events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

      return {
        tokenId,
        amount0Minted,
        amount1Minted,
        liquidityMinted,
        tx,
      };
    };

    const increaseLiquidity = async (tokenId, usdcAmount, usdtAmount) => {
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      const [maxUSDC, maxUSDT] = await findMaxDepositableAmount(
        storedPosition.lowerTick,
        storedPosition.upperTick,
        BigNumber.from(usdcAmount).mul(10 ** 6),
        BigNumber.from(usdtAmount).mul(10 ** 6)
      );

      const tx = await strategy
        .connect(operator)
        .increaseActivePositionLiquidity(
          maxUSDC,
          maxUSDT,
          maxUSDC.mul(9900).div(10000),
          maxUSDT.mul(9900).div(10000)
        );

      const { events } = await tx.wait();

      const [, amount0Added, amount1Added, liquidityAdded] = events.find(
        (e) => e.event == "UniswapV3LiquidityAdded"
      ).args;

      return {
        tokenId,
        amount0Added,
        amount1Added,
        liquidityAdded,
        tx,
      };
    };

    const mintLiquidityBySwapping = async (
      lowerTick,
      upperTick,
      usdcAmount,
      usdtAmount,
      swapAmountIn,
      swapMinAmountOut,
      sqrtPriceLimitX96,
      swapZeroForOne
    ) => {
      const [maxUSDC, maxUSDT] = await findMaxDepositableAmount(
        lowerTick,
        upperTick,
        BigNumber.from(usdcAmount).mul(10 ** 6),
        BigNumber.from(usdtAmount).mul(10 ** 6)
      );

      const tx = await strategy.connect(operator).swapAndRebalance({
        desiredAmount0: maxUSDC,
        desiredAmount1: maxUSDT,
        minAmount0: maxUSDC.mul(9900).div(10000),
        minAmount1: maxUSDT.mul(9900).div(10000),
        minRedeemAmount0: 0,
        minRedeemAmount1: 0,
        lowerTick,
        upperTick,
        swapAmountIn: BigNumber.from(swapAmountIn).mul(10 ** 6),
        swapMinAmountOut: BigNumber.from(swapMinAmountOut).mul(10 ** 6),
        sqrtPriceLimitX96,
        swapZeroForOne,
      });

      const { events } = await tx.wait();

      const [tokenId, amount0Minted, amount1Minted, liquidityMinted] =
        events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

      return {
        tokenId,
        amount0Minted,
        amount1Minted,
        liquidityMinted,
        tx,
      };
    };

    async function _swap(user, amount, zeroForOne) {
      const [, activeTick] = await pool.slot0();
      const sqrtPriceLimitX96 = await v3Helper.getSqrtRatioAtTick(
        activeTick + (zeroForOne ? -2 : 2)
      );
      const swapAmount = BigNumber.from(amount).mul(1e6);
      usdc.connect(user).approve(swapRouter.address, 0);
      usdt.connect(user).approve(swapRouter.address, 0);
      usdc.connect(user).approve(swapRouter.address, swapAmount.mul(1e3));
      usdt.connect(user).approve(swapRouter.address, swapAmount.mul(1e3));
      await swapRouter.connect(user).exactInputSingle([
        zeroForOne ? usdc.address : usdt.address, // tokenIn
        zeroForOne ? usdt.address : usdc.address, // tokenOut
        100, // fee
        user.address, // recipient
        (await getBlockTimestamp()) + 10, // deadline
        swapAmount, // amountIn
        0, // amountOutMinimum
        sqrtPriceLimitX96,
      ]);
    }

    it("Should mint position", async () => {
      const usdcBalBefore = await strategy.checkBalance(usdc.address);
      const usdtBalBefore = await strategy.checkBalance(usdt.address);

      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 1000;
      const upperTick = activeTick + 1000;

      const { tokenId, amount0Minted, amount1Minted, liquidityMinted, tx } =
        await mintLiquidity(lowerTick, upperTick, "100000", "100000");

      // Check events
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      await expect(tx).to.have.emittedEvent("UniswapV3LiquidityAdded");

      // Check minted position data
      const nfp = await positionManager.positions(tokenId);
      expect(nfp.token0).to.equal(usdc.address, "Invalid token0 address");
      expect(nfp.token1).to.equal(usdt.address, "Invalid token1 address");
      expect(nfp.tickLower).to.equal(lowerTick, "Invalid lower tick");
      expect(nfp.tickUpper).to.equal(upperTick, "Invalid upper tick");

      // Check Strategy balance
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);
      expect(usdcBalAfter).gte(
        usdcBalBefore,
        "Expected USDC balance to have increased"
      );
      expect(usdtBalAfter).gte(
        usdtBalBefore,
        "Expected USDT balance to have increased"
      );
      expect(usdcBalAfter).to.approxEqual(
        usdcBalBefore.add(amount0Minted),
        "Deposited USDC mismatch"
      );
      expect(usdtBalAfter).to.approxEqual(
        usdtBalBefore.add(amount1Minted),
        "Deposited USDT mismatch"
      );

      // Check data on strategy
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(storedPosition.tokenId).to.equal(tokenId);
      expect(storedPosition.lowerTick).to.equal(lowerTick);
      expect(storedPosition.upperTick).to.equal(upperTick);
      expect(storedPosition.liquidity).to.equal(liquidityMinted);
      expect(storedPosition.netValue).to.equal(
        amount0Minted.add(amount1Minted).mul(BigNumber.from(1e12))
      );
      expect(await strategy.activeTokenId()).to.equal(tokenId);
    });

    it("Should not mint if the position is out of hard boundary tick range", async () => {
      await setRebalancePriceThreshold(-5, 5);

      const lowerTick = -10;
      const upperTick = 10;

      await expect(
        mintLiquidity(lowerTick, upperTick, "100000", "100000")
      ).to.be.revertedWith("Rebalance position out of bounds");
    });

    it("Should not mint if the position surpasses the maxTVL amount", async () => {
      // set max TVL of 100 units (denominated in 18 decimals)
      await setMaxTVL("100");

      const lowerTick = -10;
      const upperTick = 10;

      await expect(
        mintLiquidity(lowerTick, upperTick, "100000", "100000")
      ).to.be.revertedWith("MaxTVL threshold has been reached");
    });

    it("Should swap USDC for USDT and mint position", async () => {
      // Move all USDT out of reserve
      await reserveStrategy
        .connect(await impersonateAndFundContract(vault.address))
        .withdraw(
          vault.address,
          usdt.address,
          await reserveStrategy.checkBalance(usdt.address)
        );

      const usdcBalBefore = await strategy.checkBalance(usdc.address);
      const usdtBalBefore = await strategy.checkBalance(usdt.address);

      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 1000;
      const upperTick = activeTick + 1000;

      const swapAmountIn = "101000";
      const swapAmountOut = "100000";
      const sqrtPriceLimitX96 = v3Helper.getSqrtRatioAtTick(activeTick - 50);
      const swapZeroForOne = true;

      const { tokenId, amount0Minted, amount1Minted, liquidityMinted, tx } =
        await mintLiquidityBySwapping(
          lowerTick,
          upperTick,
          "100000",
          "100000",
          swapAmountIn,
          swapAmountOut,
          sqrtPriceLimitX96,
          swapZeroForOne
        );

      // Check events
      await expect(tx).to.have.emittedEvent("AssetSwappedForRebalancing");
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      await expect(tx).to.have.emittedEvent("UniswapV3LiquidityAdded");

      // Check minted position data
      const nfp = await positionManager.positions(tokenId);
      expect(nfp.token0).to.equal(usdc.address, "Invalid token0 address");
      expect(nfp.token1).to.equal(usdt.address, "Invalid token1 address");
      expect(nfp.tickLower).to.equal(lowerTick, "Invalid lower tick");
      expect(nfp.tickUpper).to.equal(upperTick, "Invalid upper tick");

      // Check Strategy balance
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);
      expect(usdcBalAfter).gte(
        usdcBalBefore,
        "Expected USDC balance to have increased"
      );
      expect(usdtBalAfter).gte(
        usdtBalBefore,
        "Expected USDT balance to have increased"
      );
      // expect(usdcBalAfter).to.approxEqualTolerance(
      //   usdcBalBefore.add(amount0Minted),
      //   1,
      //   "Deposited USDC mismatch"
      // );
      // expect(usdtBalAfter).to.approxEqualTolerance(
      //   usdtBalBefore.add(amount1Minted),
      //   1,
      //   "Deposited USDT mismatch"
      // );

      // Check data on strategy
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(storedPosition.tokenId).to.equal(tokenId);
      expect(storedPosition.lowerTick).to.equal(lowerTick);
      expect(storedPosition.upperTick).to.equal(upperTick);
      expect(storedPosition.liquidity).to.equal(liquidityMinted);
      expect(storedPosition.netValue).to.equal(
        amount0Minted.add(amount1Minted).mul(BigNumber.from(1e12))
      );
      expect(await strategy.activeTokenId()).to.equal(tokenId);
    });

    it("Should swap USDT for USDC and mint position", async () => {
      // Move all USDC out of reserve
      await reserveStrategy
        .connect(await impersonateAndFundContract(vault.address))
        .withdraw(
          vault.address,
          usdc.address,
          await reserveStrategy.checkBalance(usdc.address)
        );

      const usdcBalBefore = await strategy.checkBalance(usdc.address);
      const usdtBalBefore = await strategy.checkBalance(usdt.address);

      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 1000;
      const upperTick = activeTick + 1000;

      const swapAmountIn = "101000";
      const swapAmountOut = "100000";
      const sqrtPriceLimitX96 = v3Helper.getSqrtRatioAtTick(activeTick + 50);
      const swapZeroForOne = false;

      const { tokenId, amount0Minted, amount1Minted, liquidityMinted, tx } =
        await mintLiquidityBySwapping(
          lowerTick,
          upperTick,
          "100000",
          "100000",
          swapAmountIn,
          swapAmountOut,
          sqrtPriceLimitX96,
          swapZeroForOne
        );

      // Check events
      await expect(tx).to.have.emittedEvent("AssetSwappedForRebalancing");
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      await expect(tx).to.have.emittedEvent("UniswapV3LiquidityAdded");

      // Check minted position data
      const nfp = await positionManager.positions(tokenId);
      expect(nfp.token0).to.equal(usdc.address, "Invalid token0 address");
      expect(nfp.token1).to.equal(usdt.address, "Invalid token1 address");
      expect(nfp.tickLower).to.equal(lowerTick, "Invalid lower tick");
      expect(nfp.tickUpper).to.equal(upperTick, "Invalid upper tick");

      // Check Strategy balance
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);

      expect(usdcBalAfter).gte(
        usdcBalBefore,
        "Expected USDC balance to have increased"
      );
      expect(usdtBalAfter).gte(
        usdtBalBefore,
        "Expected USDT balance to have increased"
      );
      // expect(usdcBalAfter).to.approxEqual(
      //   usdcBalBefore.add(amount0Minted),
      //   "Deposited USDC mismatch"
      // );
      // expect(usdtBalAfter).to.approxEqual(
      //   usdtBalBefore.add(amount1Minted),
      //   "Deposited USDT mismatch"
      // );

      // Check data on strategy
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(storedPosition.tokenId).to.equal(tokenId);
      expect(storedPosition.lowerTick).to.equal(lowerTick);
      expect(storedPosition.upperTick).to.equal(upperTick);
      expect(storedPosition.liquidity).to.equal(liquidityMinted);
      expect(storedPosition.netValue).to.equal(
        amount0Minted.add(amount1Minted).mul(BigNumber.from(1e12))
      );
      expect(await strategy.activeTokenId()).to.equal(tokenId);
    });

    it("Should increase liquidity of existing position", async () => {
      const usdcBalBefore = await strategy.checkBalance(usdc.address);
      const usdtBalBefore = await strategy.checkBalance(usdt.address);

      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 1003;
      const upperTick = activeTick + 1005;

      const amount = "100000";
      const amountUnits = BigNumber.from(amount).mul(10 ** 6);

      // Mint position
      const { tokenId, tx, amount0Minted, amount1Minted, liquidityMinted } =
        await mintLiquidity(lowerTick, upperTick, amount, amount);
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      let storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(storedPosition.liquidity).to.equal(liquidityMinted);
      expect(storedPosition.netValue).to.equal(
        amount0Minted.add(amount1Minted).mul(BigNumber.from(1e12))
      );
      expect(await strategy.activeTokenId()).to.equal(tokenId);

      // Rebalance again to increase liquidity
      const {
        tx: increaseTx,
        amount0Added,
        amount1Added,
        liquidityAdded,
      } = await increaseLiquidity(tokenId, amount, amount);
      await expect(increaseTx).to.have.emittedEvent("UniswapV3LiquidityAdded");

      // Check storage
      storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.liquidity).to.approxEqual(
        liquidityMinted.add(liquidityAdded)
      );
      expect(storedPosition.netValue).to.approxEqual(
        amount0Minted
          .add(amount1Minted)
          .add(amount0Added)
          .add(amount1Added)
          .mul(BigNumber.from(1e12))
      );

      // Check balance on strategy
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);
      expect(usdcBalAfter).to.approxEqualTolerance(
        usdcBalBefore.add(amountUnits.mul(2)),
        1,
        "Deposited USDC mismatch"
      );
      expect(usdtBalAfter).to.approxEqualTolerance(
        usdtBalBefore.add(amountUnits.mul(2)),
        1,
        "Deposited USDT mismatch"
      );
    });

    it("Should close LP position", async () => {
      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 1003;
      const upperTick = activeTick + 1005;

      const amount = "100000";

      // Mint position
      const { tokenId, tx } = await mintLiquidity(
        lowerTick,
        upperTick,
        amount,
        amount
      );
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      let storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.activeTokenId()).to.equal(tokenId);

      // Remove liquidity
      const tx2 = await strategy.connect(operator).closePosition(tokenId, 0, 0);
      await expect(tx2).to.have.emittedEvent("UniswapV3LiquidityRemoved");

      // Check storage
      storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.liquidity).to.be.equal(0);
      expect(storedPosition.netValue).to.be.equal(0);

      expect(await strategy.activeTokenId()).to.equal(
        BigNumber.from(0),
        "Should have no active position"
      );

      // Check balance on strategy
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);
      await expect(strategy).to.have.an.approxBalanceOf(usdcBalAfter, usdc);
      await expect(strategy).to.have.an.approxBalanceOf(usdtBalAfter, usdt);
    });

    it("Should collect fees", async () => {
      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick - 12;
      const upperTick = activeTick + 49;

      // Mint position
      const amount = "100000";
      const { tokenId, tx } = await mintLiquidity(
        lowerTick,
        upperTick,
        amount,
        amount
      );
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.activeTokenId()).to.equal(tokenId);

      // Do some big swaps
      await _swap(matt, "1000000", true);
      await _swap(josh, "1000000", false);
      await _swap(franck, "1000000", true);
      await _swap(daniel, "1000000", false);
      await _swap(domen, "1000000", true);

      // Check fee amounts
      let [fee0, fee1] = await strategy.getPendingFees();
      expect(fee0).to.be.gt(0);
      expect(fee1).to.be.gt(0);

      // Collect fees
      await strategy.connect(operator).collectFees();
      [fee0, fee1] = await strategy.getPendingFees();
      expect(fee0).to.equal(0);
      expect(fee1).to.equal(0);
    });

    it("Should not mint if net loss threshold is breached", async () => {
      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick;
      const upperTick = activeTick + 1;

      // Mint position
      const amount = "100000";
      const { tokenId, tx, amount0Minted, amount1Minted, liquidityMinted } =
        await mintLiquidity(lowerTick, upperTick, amount, amount);
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      let storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.activeTokenId()).to.equal(tokenId);
      expect(await strategy.netLostValue()).to.equal(0);

      // Do some big swaps to move active tick
      await _swap(matt, "100000", false);
      await _swap(josh, "100000", false);
      await _swap(franck, "100000", false);
      await _swap(daniel, "100000", false);
      await _swap(domen, "100000", false);

      // Set threshold to a low value to see if it throws
      await setMaxPositionValueLostThreshold("0.01");
      await expect(
        strategy
          .connect(operator)
          .increaseActivePositionLiquidity("1000000", "1000000", "0", "0")
      ).to.be.revertedWith("Over max value loss threshold");

      // Set the threshold higher and make sure the net loss event is emitted
      // and state updated properly
      await setMaxPositionValueLostThreshold("1000000000000000");
      const {
        tx: increaseTx,
        amount0Added,
        amount1Added,
        liquidityAdded,
      } = await increaseLiquidity(tokenId, "1", "1");
      await expect(increaseTx).to.have.emittedEvent("PositionValueChanged");

      storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.liquidity).approxEqual(
        liquidityMinted.add(liquidityAdded)
      );
      const netLost = await strategy.netLostValue();
      expect(netLost).to.be.gte(0, "Expected lost value to have been updated");
      expect(storedPosition.netValue).to.be.lte(
        amount0Minted
          .add(amount1Minted)
          .add(amount0Added)
          .add(amount1Added)
          .mul(1e12)
          .sub(netLost)
      );
    });

    it("Should be allowed to close position when net loss threshold is breached", async () => {
      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick;
      const upperTick = activeTick + 1;

      // Mint position
      const amount = "100000";
      const { tokenId, tx, amount0Minted, amount1Minted } = await mintLiquidity(
        lowerTick,
        upperTick,
        amount,
        amount
      );
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      let storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.activeTokenId()).to.equal(tokenId);
      expect(await strategy.netLostValue()).to.equal(0);

      // Do some big swaps to move active tick
      await _swap(matt, "100000", false);
      await _swap(josh, "100000", false);
      await _swap(franck, "100000", false);
      await _swap(daniel, "100000", false);
      await _swap(domen, "100000", false);

      // Set threshold to a low value to see if it throws
      await setMaxPositionValueLostThreshold("0.01");
      await expect(
        strategy
          .connect(operator)
          .increaseActivePositionLiquidity("1000000", "1000000", "0", "0")
      ).to.be.revertedWith("Over max value loss threshold");

      // should still be allowed to close the position
      strategy
        .connect(operator)
        .closePosition(
          tokenId,
          Math.round(amount0Minted * 0.92),
          Math.round(amount1Minted * 0.92)
        );
    });

    it("netLostValue will catch possible pool tilts", async () => {
      const [, activeTick] = await pool.slot0();
      const lowerTick = activeTick;
      const upperTick = activeTick + 1;
      let drainLoops = 10;
      while (drainLoops > 0) {
        const amount = "10000";
        await mintLiquidity(lowerTick, upperTick, amount, amount);
        // Mint position
        // Do some big swaps to move active tick
        await _swap(daniel, "500000", false);
        await _swap(josh, "500000", false);

        await mintLiquidity(lowerTick, upperTick, amount, amount);

        expect(await strategy.netLostValue()).gte(
          0,
          "Expected netLostValue to be greater than 0"
        );

        await _swap(daniel, "500000", true);
        await _swap(josh, "500000", true);
        drainLoops--;
      }
    });
  });

  describe("Sanity checks", () => {
    describe("Mint", function () {
      const mintTest = async (user, amount, asset) => {
        const ousdAmount = ousdUnits(amount);
        const tokenAmount = await units(amount, asset);

        const currentSupply = await ousd.totalSupply();
        const ousdBalance = await ousd.balanceOf(user.address);
        const tokenBalance = await asset.balanceOf(user.address);
        const reserveTokenBalance = await reserveStrategy.checkBalance(
          asset.address
        );

        // await asset.connect(user).approve(vault.address, tokenAmount)
        await vault.connect(user).mint(asset.address, tokenAmount, 0);

        await expect(ousd).to.have.an.approxTotalSupplyOf(
          currentSupply.add(ousdAmount),
          "Total supply mismatch"
        );
        if (asset == dai) {
          // DAI is unsupported and should not be deposited in reserve strategy
          await expect(reserveStrategy).to.have.an.assetBalanceOf(
            reserveTokenBalance,
            asset,
            "Expected reserve strategy to not support DAI"
          );
        } else {
          await expect(reserveStrategy).to.have.an.assetBalanceOf(
            reserveTokenBalance.add(tokenAmount),
            asset,
            "Expected reserve strategy to have received the other token"
          );
        }

        await expect(user).to.have.an.approxBalanceWithToleranceOf(
          ousdBalance.add(ousdAmount),
          ousd,
          1,
          "Should've minted equivalent OUSD"
        );
        await expect(user).to.have.an.approxBalanceWithToleranceOf(
          tokenBalance.sub(tokenAmount),
          asset,
          1,
          "Should've deposoited equivaluent other token"
        );
      };

      it("with USDC", async () => {
        await mintTest(daniel, "30000", usdc);
      });
      it("with USDT", async () => {
        await mintTest(domen, "30000", usdt);
      });
      it("with DAI", async () => {
        await mintTest(franck, "30000", dai);
      });
    });

    describe("Redeem", function () {
      const redeemTest = async (user, amount) => {
        const ousdAmount = ousdUnits(amount);

        let ousdBalance = await ousd.balanceOf(user.address);
        if (ousdBalance.lt(ousdAmount)) {
          // Mint some OUSD
          await vault.connect(user).mint(dai.address, daiUnits(amount), 0);
          ousdBalance = await ousd.balanceOf(user.address);
        }

        const currentSupply = await ousd.totalSupply();
        const usdcBalance = await usdc.balanceOf(user.address);
        const usdtBalance = await usdt.balanceOf(user.address);
        const daiBalance = await dai.balanceOf(user.address);

        await vault.connect(user).redeem(ousdAmount, 0);

        await expect(ousd).to.have.an.approxTotalSupplyOf(
          currentSupply.sub(ousdAmount),
          "Total supply mismatch"
        );
        await expect(user).to.have.an.approxBalanceWithToleranceOf(
          ousdBalance.sub(ousdAmount),
          ousd,
          1,
          "Should've burned equivalent OUSD"
        );

        const balanceDiff =
          parseFloat(
            usdcUnitsFormat((await usdc.balanceOf(user.address)) - usdcBalance)
          ) +
          parseFloat(
            usdtUnitsFormat((await usdt.balanceOf(user.address)) - usdtBalance)
          ) +
          parseFloat(
            daiUnitsFormat((await dai.balanceOf(user.address)) - daiBalance)
          );

        await expect(balanceDiff).to.approxEqualTolerance(
          amount,
          1,
          "Should've redeemed equivaluent other token"
        );
      };

      it.skip("Should withdraw from reserve strategy", async () => {
        // Withdraw liquidates current position, so this test is no longer valid
        redeemTest(josh, "10000");
      });
    });
  });
});
