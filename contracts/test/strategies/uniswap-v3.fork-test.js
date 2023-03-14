const { expect } = require("chai");
const { uniswapV3FixturSetup } = require("../_fixture");
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
const { BigNumber } = require("ethers");

const uniswapV3Fixture = uniswapV3FixturSetup();

forkOnlyDescribe("Uniswap V3 Strategy", function () {
  this.timeout(0);

  let fixture;
  let vault, harvester, ousd, usdc, usdt, dai;
  let reserveStrategy, strategy, pool, positionManager, v3Helper, swapRouter;
  let timelock,
    // governor,
    // strategist,
    operator,
    josh,
    matt,
    daniel,
    domen,
    franck;

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
    harvester = fixture.harvester;
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
          [maxUSDC, maxUSDT], 
          [maxUSDC.mul(9900).div(10000), maxUSDT.mul(9900).div(10000)],
          [0, 0],
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

    it.only("Should mint position", async () => {
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
      expect(await strategy.currentPositionTokenId()).to.equal(tokenId);
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
      const { tokenId, tx } = await mintLiquidity(
        lowerTick,
        upperTick,
        amount,
        amount
      );
      await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.currentPositionTokenId()).to.equal(tokenId);

      // Rebalance again to increase liquidity
      const tx2 = await strategy
        .connect(operator)
        .increaseLiquidityForActivePosition(amountUnits, amountUnits);
      await expect(tx2).to.have.emittedEvent("UniswapV3LiquidityAdded");

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
      const storedPosition = await strategy.tokenIdToPosition(tokenId);
      expect(storedPosition.exists).to.be.true;
      expect(await strategy.currentPositionTokenId()).to.equal(tokenId);

      // Remove liquidity
      const tx2 = await strategy.connect(operator).closePosition(tokenId);
      await expect(tx2).to.have.emittedEvent("UniswapV3LiquidityRemoved");

      expect(await strategy.currentPositionTokenId()).to.equal(
        BigNumber.from(0),
        "Should have no active position"
      );

      // Check balance on strategy
      const usdcBalAfter = await strategy.checkBalance(usdc.address);
      const usdtBalAfter = await strategy.checkBalance(usdt.address);
      expect(usdcBalAfter).to.equal(
        BigNumber.from(0),
        "Expected to have liquidated all USDC"
      );
      expect(usdtBalAfter).to.equal(
        BigNumber.from(0),
        "Expected to have liquidated all USDT"
      );
    });

    async function _swap(user, amount, zeroForOne) {
      const [, activeTick] = await pool.slot0();
      const sqrtPriceLimitX96 = await v3Helper.getSqrtRatioAtTick(
        activeTick + (zeroForOne ? -2 : 2)
      );
      const swapAmount = BigNumber.from(amount).mul(10 ** 6);
      usdc.connect(user).approve(swapRouter.address, swapAmount.mul(10));
      usdt.connect(user).approve(swapRouter.address, swapAmount.mul(10));
      await swapRouter.connect(user).exactInputSingle([
        zeroForOne ? usdc.address : usdt.address, // tokenIn
        zeroForOne ? usdt.address : usdc.address, // tokenOut
        100, // fee
        user.address, // recipient
        (await getBlockTimestamp()) + 5, // deadline
        swapAmount, // amountIn
        0, // amountOutMinimum
        sqrtPriceLimitX96,
      ]);
    }

    it("Should collect rewards", async () => {
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
      expect(await strategy.currentPositionTokenId()).to.equal(tokenId);

      // Do some big swaps
      await _swap(matt, "1000000", true);
      await _swap(josh, "1000000", false);
      await _swap(franck, "1000000", true);
      await _swap(daniel, "1000000", false);
      await _swap(domen, "1000000", true);

      // Check reward amounts
      let [fee0, fee1] = await strategy.getPendingFees();
      expect(fee0).to.be.gt(0);
      expect(fee1).to.be.gt(0);

      // Harvest rewards
      await harvester.connect(timelock)["harvest(address)"](strategy.address);
      [fee0, fee1] = await strategy.getPendingFees();
      expect(fee0).to.equal(0);
      expect(fee1).to.equal(0);
    });
  });

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

    it("Should withdraw from reserve strategy", async () => {
      redeemTest(josh, "10000");
    });
  });
});
