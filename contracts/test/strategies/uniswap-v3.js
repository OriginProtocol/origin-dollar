const { expect } = require("chai");
const { uniswapV3FixtureSetup } = require("../_fixture");
const {
  units,
  ousdUnits,
  expectApproxSupply,
  usdcUnits,
  usdtUnits,
} = require("../helpers");
const { deployments } = require("hardhat");
const { utils, BigNumber } = require("ethers")

const uniswapV3Fixture = uniswapV3FixtureSetup();

const liquidityManagerFixture = deployments.createFixture(async () => {
  const fixture = await uniswapV3Fixture();
  const { franck, daniel, domen, vault, usdc, usdt, dai } = fixture;

  // Mint some liquidity
  for (const user of [franck, daniel, domen]) {
    for (const asset of [usdc, usdt, dai]) {
      const amount = "1000000";
      await asset.connect(user).mint(await units(amount, asset));
      await asset
        .connect(user)
        .approve(vault.address, await units(amount, asset));
      await vault
        .connect(user)
        .mint(asset.address, await units(amount, asset), 0);
    }
  }

  // Configure mockPool
  const { UniV3_USDC_USDT_Pool: mockPool, governor } = fixture;
  await mockPool.connect(governor).setTick(-2);

  await fixture.UniV3_USDC_USDT_Strategy.connect(
    governor
  ).setMaxPositionValueLossThreshold(ousdUnits("50000", 18));

  return fixture;
});

const activePositionFixture = deployments.createFixture(async () => {
  const fixture = await liquidityManagerFixture();

  // Mint a position
  const { operator, UniV3_USDC_USDT_Strategy } = fixture;
  await UniV3_USDC_USDT_Strategy.connect(operator).rebalance(
    usdcUnits("100000"),
    usdcUnits("100000"),
    "0",
    "0",
    "0",
    "0",
    "-100",
    "100"
  );

  return fixture;
});

describe("Uniswap V3 Strategy", function () {
  let fixture;
  let vault, ousd, usdc, usdt, dai;
  let reserveStrategy,
    strategy,
    helper,
    mockPool,
    mockPositionManager,
    mockStrategy2,
    mockStrategyDAI;
  let governor, strategist, operator, josh, matt, daniel, domen, franck;

  const mint = async (user, amount, asset) => {
    await asset.connect(user).mint(await units(amount, asset));
    await asset
      .connect(user)
      .approve(vault.address, await units(amount, asset));
    await vault
      .connect(user)
      .mint(asset.address, await units(amount, asset), 0);
  };

  function _destructureFixture(_fixture) {
    fixture = _fixture;
    reserveStrategy = _fixture.mockStrategy;
    mockStrategy2 = _fixture.mockStrategy2;
    mockStrategyDAI = _fixture.mockStrategyDAI;
    strategy = _fixture.UniV3_USDC_USDT_Strategy;
    helper = _fixture.UniV3Helper;
    mockPool = _fixture.UniV3_USDC_USDT_Pool;
    mockPositionManager = _fixture.UniV3PositionManager;
    ousd = _fixture.ousd;
    usdc = _fixture.usdc;
    usdt = _fixture.usdt;
    dai = _fixture.dai;
    vault = _fixture.vault;
    // harvester = _fixture.harvester;
    governor = _fixture.governor;
    strategist = _fixture.strategist;
    operator = _fixture.operator;
    josh = _fixture.josh;
    matt = _fixture.matt;
    daniel = _fixture.daniel;
    domen = _fixture.domen;
    franck = _fixture.franck;
  }

  for (const assetSymbol of ["USDC", "USDT"]) {
    describe(`Mint w/ ${assetSymbol}`, function () {
      let asset;
      beforeEach(async () => {
        _destructureFixture(await uniswapV3Fixture());
        asset = assetSymbol == "USDT" ? usdt : usdc;
      });

      it("Should mint w/o allocate", async () => {
        // Vault has 200 DAI from fixtures
        await expectApproxSupply(ousd, ousdUnits("200"));
        await expect(vault).has.an.approxBalanceOf("200", dai);
        // Mint some OUSD with USDC/USDT
        await mint(daniel, "10000", asset);
        await expectApproxSupply(ousd, ousdUnits("10200"));
        // Make sure it's in vault
        await expect(vault).has.an.approxBalanceOf("10000", asset);
      });

      it("Should mint and allocate to reserve strategy", async () => {
        // Vault has 200 DAI from fixtures
        await expectApproxSupply(ousd, ousdUnits("200"));
        await expect(vault).has.an.approxBalanceOf("200", dai);
        // Mint some OUSD with USDC/USDT
        await mint(franck, "30000", asset);
        await expectApproxSupply(ousd, ousdUnits("30200"));
        // Make sure it went to reserve strategy
        await expect(reserveStrategy).has.an.approxBalanceOf("30000", asset);
      });
    });
  }

  describe("Redeem", function () {
    beforeEach(async () => {
      _destructureFixture(await uniswapV3Fixture());
    });

    it("Should withdraw from vault balance", async () => {
      // Vault has 200 DAI from fixtures
      await expectApproxSupply(ousd, ousdUnits("200"));
      await expect(vault).has.an.approxBalanceOf("200", dai);
      // Mint some OUSD with USDC
      await mint(domen, "10000", usdc);

      // Try redeem
      await vault.connect(domen).redeem(ousdUnits("10000"), 0);
      await expectApproxSupply(ousd, ousdUnits("200"));
    });

    it("Should withdraw from reserve strategy", async () => {
      // Vault has 200 DAI from fixtures
      await expectApproxSupply(ousd, ousdUnits("200"));
      await expect(vault).has.an.approxBalanceOf("200", dai);
      // Mint some OUSD with USDT
      await mint(matt, "30000", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(reserveStrategy).has.an.approxBalanceOf("30000", usdt);

      // Try redeem
      await vault.connect(matt).redeem(ousdUnits("30000"), 0);
      await expectApproxSupply(ousd, ousdUnits("200"));
    });

    it.skip("Should withdraw from active position");
  });

  describe("Admin functions", () => {
    beforeEach(async () => {
      _destructureFixture(await uniswapV3Fixture());
    });

    describe("setOperator()", () => {
      it("Governor can set the operator", async () => {
        const addr1 = "0x0000000000000000000000000000000000011111";
        await strategy.connect(governor).setOperator(addr1);
        expect(await strategy.operatorAddr()).to.equal(addr1);
      });
      it("Strategist can set the operator", async () => {
        const addr1 = "0x0000000000000000000000000000000000011111";
        await strategy.connect(strategist).setOperator(addr1);
        expect(await strategy.operatorAddr()).to.equal(addr1);
      });
      it("Should not change operator if not governor/strategist", async () => {
        const addr1 = "0x0000000000000000000000000000000000011111";
        await expect(
          strategy.connect(operator).setOperator(addr1)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
        await expect(
          strategy.connect(josh).setOperator(addr1)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      });
    });

    describe("setReserveStrategy()", () => {
      beforeEach(async () => {
        _destructureFixture(await uniswapV3Fixture());
      });

      describe("Validations", () => {
        it("Can set a valid strategy as reserve", async () => {
          await strategy
            .connect(governor)
            .setReserveStrategy(usdc.address, mockStrategy2.address);
          expect(await strategy.reserveStrategy(usdc.address)).to.equal(
            mockStrategy2.address
          );
        });
        it("Cannot set an unsupported strategy as reserve", async () => {
          await expect(
            strategy
              .connect(governor)
              .setReserveStrategy(usdc.address, mockStrategyDAI.address)
          ).to.be.revertedWith("Invalid strategy for asset");
        });
        it("Cannot set reserve strategy for unsupported assets", async () => {
          await expect(
            strategy
              .connect(governor)
              .setReserveStrategy(dai.address, mockStrategyDAI.address)
          ).to.be.revertedWith("Unsupported asset");
        });
        it("Cannot set an unapproved strategy as reserve", async () => {
          await vault.connect(governor).removeStrategy(mockStrategy2.address);

          await expect(
            strategy
              .connect(governor)
              .setReserveStrategy(usdc.address, mockStrategy2.address)
          ).to.be.revertedWith("Unsupported strategy");
        });
      });
      describe("Permissions", () => {
        it("Governor can change reserve strategy", async () => {
          await strategy
            .connect(governor)
            .setReserveStrategy(usdc.address, mockStrategy2.address);
          expect(await strategy.reserveStrategy(usdc.address)).to.equal(
            mockStrategy2.address
          );
        });
        it("Strategist can change reserve strategy", async () => {
          await strategy
            .connect(strategist)
            .setReserveStrategy(usdc.address, mockStrategy2.address);
          expect(await strategy.reserveStrategy(usdc.address)).to.equal(
            mockStrategy2.address
          );
        });
        it("Anyone else cannot change reserve strategy", async () => {
          await expect(
            strategy
              .connect(operator)
              .setReserveStrategy(usdc.address, mockStrategy2.address)
          ).to.be.revertedWith("Caller is not the Strategist or Governor");
        });
      });
    });

    describe("setMinDepositThreshold()", () => {
      beforeEach(async () => {
        _destructureFixture(await uniswapV3Fixture());
      });

      describe("Permissions", () => {
        it("Governer & Strategist can set the threshold", async () => {
          await strategy
            .connect(governor)
            .setMinDepositThreshold(usdc.address, "1000");
          await strategy
            .connect(strategist)
            .setMinDepositThreshold(usdc.address, "2000");
        });
        it("Nobody else can change the threshold", async () => {
          await expect(
            strategy
              .connect(operator)
              .setMinDepositThreshold(usdc.address, "2000")
          ).to.be.revertedWith("Caller is not the Strategist or Governor");
        });
      });
      describe("Validations", () => {
        it("Cannot call with invalid assets", async () => {
          await expect(
            strategy
              .connect(governor)
              .setMinDepositThreshold(dai.address, "2000")
          ).to.be.revertedWith("Unsupported asset");
        });
      });
    });

    describe("setRebalancePaused()", () => {
      beforeEach(async () => {
        _destructureFixture(await uniswapV3Fixture());
      });

      it("Governer & Strategist can pause rebalance", async () => {
        await strategy.connect(governor).setRebalancePaused(true);
        expect(await strategy.rebalancePaused()).to.be.true;
        await strategy.connect(strategist).setRebalancePaused(false);
        expect(await strategy.rebalancePaused()).to.be.false;
      });
      it("Nobody else can pause rebalance", async () => {
        await expect(
          strategy.connect(operator).setRebalancePaused(false)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      });
    });

    describe("setSwapsPaused()", () => {
      beforeEach(async () => {
        _destructureFixture(await uniswapV3Fixture());
      });

      it("Governer & Strategist can pause swaps", async () => {
        await strategy.connect(governor).setSwapsPaused(true);
        expect(await strategy.swapsPaused()).to.be.true;
        await strategy.connect(strategist).setSwapsPaused(false);
        expect(await strategy.swapsPaused()).to.be.false;
      });
      it("Nobody else can pause swaps", async () => {
        await expect(
          strategy.connect(operator).setSwapsPaused(false)
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      });
    });

    describe.skip("setSwapPriceThreshold()", () => {});

    describe.skip("setTokenPriceLimit()", () => {});
  });

  describe("LiquidityManager", function () {
    const mintLiquidity = async ({
      amount0,
      amount1,
      minAmount0,
      minAmount1,
      minRedeemAmount0,
      minRedeemAmount1,
      lowerTick,
      upperTick,
      existingPosition,
    }) => {
      const tx = await strategy
        .connect(operator)
        .rebalance(
          usdcUnits(amount0),
          usdtUnits(amount1),
          usdcUnits(minAmount0 || "0"),
          usdtUnits(minAmount1 || "0"),
          usdcUnits(minRedeemAmount0 || "0"),
          usdtUnits(minRedeemAmount1 || "0"),
          lowerTick,
          upperTick
        );

      if (!existingPosition) {
        await expect(tx).to.have.emittedEvent("UniswapV3PositionMinted");
      }

      await expect(tx).to.have.emittedEvent("UniswapV3LiquidityAdded");

      return await tx.wait();
    };

    describe("Rebalance/Mint", () => {
      beforeEach(async () => {
        _destructureFixture(await liquidityManagerFixture());
      });

      it("Should mint a new position (with reserve funds)", async () => {
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-1000",
          upperTick: "1000",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );
      });

      it("Should mint a new position below active tick", async () => {
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-1000",
          upperTick: "-500",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );
      });

      it("Should mint a new position above active tick", async () => {
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "1000",
          upperTick: "1500",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );
      });

      it("Should mint a new position (without reserve funds)", async () => {
        // Transfer some tokens to strategy
        const amount = await units("1000000", usdc);
        await usdc.connect(josh).mint(amount);
        await usdt.connect(josh).mint(amount);
        await usdc.connect(josh).transfer(strategy.address, amount);
        await usdt.connect(josh).transfer(strategy.address, amount);

        const reserve0Bal = await reserveStrategy.checkBalance(usdc.address);
        const reserve1Bal = await reserveStrategy.checkBalance(usdt.address);

        // Mint
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-100",
          upperTick: "100",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );

        // Should have deposited everything to reserve after mint
        expect(await usdc.balanceOf(strategy.address)).to.equal(0);
        expect(await reserveStrategy.checkBalance(usdc.address)).to.approxEqual(
          reserve0Bal.add(amount).sub(amount0Deposited)
        );
        expect(await usdt.balanceOf(strategy.address)).to.equal(0);
        expect(await reserveStrategy.checkBalance(usdt.address)).to.approxEqual(
          reserve1Bal.add(amount).sub(amount1Deposited)
        );
      });

      it("Should allow Governor/Strategist/Operator to rebalance", async () => {
        for (const user of [governor, strategist, operator]) {
          await strategy
            .connect(user)
            .rebalance("1", "1", "0", "0", "0", "0", "-1", "1");
        }
      });
      it("Should revert if caller isn't Governor/Strategist/Operator", async () => {
        expect(
          strategy
            .connect(matt)
            .rebalance("1", "1", "0", "0", "0", "0", "-1", "1")
        ).to.be.revertedWith(
          "Caller is not the Operator, Strategist or Governor"
        );
      });

      it("Should revert if rebalance is paused", async () => {
        await strategy.connect(governor).setRebalancePaused(true);
        expect(
          strategy
            .connect(operator)
            .rebalance("1", "1", "0", "0", "0", "0", "-1", "1")
        ).to.be.revertedWith("Rebalances are paused");
      });

      it("Should revert if out of rebalance limits", async () => {
        await strategy.connect(governor).setRebalancePriceThreshold(-100, 200);
        expect(
          strategy
            .connect(operator)
            .rebalance("1", "1", "0", "0", "0", "0", "-200", "1")
        ).to.be.revertedWith("Rebalance position out of bounds");
      });

      it("Should revert if TVL check fails", async () => {
        await strategy.connect(governor).setMaxTVL(ousdUnits("100000"));

        expect(
          strategy
            .connect(operator)
            .rebalance(
              usdcUnits("100000"),
              usdtUnits("100000"),
              "0",
              "0",
              "0",
              "0",
              "-200",
              "1"
            )
        ).to.be.revertedWith("MaxTVL threshold has been reached");
      });

      it("Should revert if reserve funds aren't available", async () => {
        const reserve0 = await reserveStrategy.checkBalance(usdt.address);
        const reserve1 = await reserveStrategy.checkBalance(usdc.address);

        expect(
          strategy
            .connect(operator)
            .rebalance(
              reserve0.mul(200),
              reserve1.mul(321),
              "0",
              "0",
              "0",
              "0",
              "-200",
              "1"
            )
        ).to.be.reverted;
      });

      it("Should revert if tick range is invalid", async () => {
        expect(
          strategy
            .connect(operator)
            .rebalance(
              usdcUnits("100000"),
              usdtUnits("100000"),
              "0",
              "0",
              "0",
              "0",
              "200",
              "100"
            )
        ).to.be.revertedWith("Invalid tick range");
      });
    });

    describe("IncreaseLiquidity", () => {
      beforeEach(async () => {
        _destructureFixture(await activePositionFixture());
      });

      it("Should increase liquidity w/ mint (if position already exists)", async () => {
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        expect(await strategy.activeTokenId()).to.equal(tokenId);
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );

        // Call mintLiquidity again
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
          existingPosition: true,
        });

        // Check storage and ensure it has increased liquidity
        expect(await strategy.activeTokenId()).to.equal(tokenId);
        const newPosition = await strategy.tokenIdToPosition(tokenId);
        expect(newPosition.liquidity).to.be.gt(liquidityMinted);
        expect(newPosition.netValue).to.be.gt(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );
      });

      it("Should increase liquidity of active position", async () => {
        const { events } = await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        const [tokenId, amount0Deposited, amount1Deposited, liquidityMinted] =
          events.find((e) => e.event == "UniswapV3LiquidityAdded").args;

        // Check storage
        expect(await strategy.activeTokenId()).to.equal(tokenId);
        const position = await strategy.tokenIdToPosition(tokenId);
        expect(position.exists).to.be.true;
        expect(position.liquidity).to.equal(liquidityMinted);
        expect(position.netValue).to.equal(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );

        // Call increaseActivePositionLiquidity
        await strategy
          .connect(governor)
          .increaseActivePositionLiquidity(
            usdcUnits("100000"),
            usdtUnits("100000"),
            "0",
            "0"
          );

        // Check storage and ensure it has increased liquidity
        const newPosition = await strategy.tokenIdToPosition(tokenId);
        expect(newPosition.liquidity).to.be.gt(liquidityMinted);
        expect(newPosition.netValue).to.be.gt(
          amount0Deposited.add(amount1Deposited).mul(1e12)
        );
      });

      it("Should revert if caller isn't Governor/Strategist/Operator", async () => {
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        for (const user of [governor, strategist, operator]) {
          await expect(
            strategy
              .connect(user)
              .increaseActivePositionLiquidity("1", "1", "0", "0")
          ).to.not.be.reverted;
        }

        expect(
          strategy
            .connect(matt)
            .increaseActivePositionLiquidity("1", "1", "0", "0")
        ).to.be.revertedWith(
          "Caller is not the Operator, Strategist or Governor"
        );
      });

      it("Should revert if no active position", async () => {
        expect(
          strategy
            .connect(operator)
            .increaseActivePositionLiquidity("1", "1", "0", "0")
        ).to.be.revertedWith("No active position");
      });

      it("Should revert if rebalance is paused", async () => {
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        await strategy.connect(governor).setRebalancePaused(true);
        expect(
          strategy
            .connect(operator)
            .increaseActivePositionLiquidity("1", "1", "0", "0")
        ).to.be.revertedWith("Rebalances are paused");
      });

      it("Should revert if reserve funds aren't available", async () => {
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        const reserve0 = await reserveStrategy.checkBalance(usdt.address);
        const reserve1 = await reserveStrategy.checkBalance(usdc.address);

        expect(
          strategy
            .connect(operator)
            .increaseActivePositionLiquidity(
              reserve0.mul(200),
              reserve1.mul(321),
              "0",
              "0"
            )
        ).to.be.reverted;
      });

      it("Should revert if TVL check fails", async () => {
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-500",
          upperTick: "500",
        });

        await strategy.connect(governor).setMaxTVL(ousdUnits("100000"));

        expect(
          strategy
            .connect(operator)
            .increaseActivePositionLiquidity("1", "1", "0", "0")
        ).to.be.revertedWith("MaxTVL threshold has been reached");
      });
    });

    describe("DecreaseLiquidity/ClosePosition", () => {
      beforeEach(async () => {
        _destructureFixture(await activePositionFixture());
      });

      it("Should close active position during a mint", async () => {
        const tokenId = await strategy.activeTokenId();

        // Mint position in a different tick range
        await mintLiquidity({
          amount0: "100000",
          amount1: "100000",
          lowerTick: "-50",
          upperTick: "5000",
        });

        expect(await strategy.activeTokenId()).to.not.equal(tokenId);
        const lastPos = await strategy.tokenIdToPosition(tokenId);
        expect(lastPos.liquidity).to.equal(
          0,
          "Should've removed all liquidity from closed position"
        );
      });

      it.skip("Should close active position", async () => {});

      it.skip("Should liquidate active position during withdraw", async () => {});

      it.skip("Should liquidate active position during withdrawAll", async () => {});

      it.skip("Should revert if caller isn't Governor/Strategist/Operator", async () => {});
    });

    describe.skip("Swap And Rebalance", () => {
      beforeEach(async () => {
        _destructureFixture(await liquidityManagerFixture());
      });
      it("Should swap token0 for token1 during rebalance", async () => {});

      it("Should swap token1 for token0 during rebalance", async () => {});

      it("Should revert if caller isn't Governor/Strategist/Operator", async () => {});

      it("Should revert if TVL check fails", async () => {});

      it("Should revert if swap is paused");

      it("Should revert if rebalance is paused");

      it("Should revert if swapping is unnecessary", async () => {});

      it("Should revert if beyond swap limits", async () => {});
    });

    describe("Fees", () => {
      beforeEach(async () => {
        _destructureFixture(await activePositionFixture());
      });

      it("Should accrue and collect fees", async () => {
        // No fee accrued yet
        let fees = await strategy.getPendingFees();
        expect(fees[0]).to.equal(0, "No fee after mint");
        expect(fees[1]).to.equal(0, "No fee after mint");

        const expectedFee0 = usdcUnits("1234");
        const expectedFee1 = usdtUnits("5678");
        const tokenId = await strategy.activeTokenId();
        await mockPositionManager.setTokensOwed(
          tokenId.toString(),
          expectedFee0.toString(),
          expectedFee1.toString()
        );

        fees = await strategy.getPendingFees();
        expect(fees[0]).to.equal(expectedFee0, "Fee0 mismatch");
        expect(fees[1]).to.equal(expectedFee1, "Fee1 mismatch");

        const tx = await strategy.connect(operator).collectFees();
        expect(tx).to.have.emittedEvent("UniswapV3FeeCollected", [
          tokenId,
          expectedFee0,
          expectedFee1,
        ]);
      });

      it("Should allow Governor/Strategist/Operator to collect fees", async () => {
        for (const user of [governor, strategist, operator]) {
          expect(strategy.connect(user).collectFees()).to.not.be.reverted;
        }
      });

      it("Should revert if caller isn't Governor/Strategist/Operator", async () => {
        await expect(strategy.connect(matt).collectFees()).to.be.revertedWith(
          "Caller is not the Operator, Strategist or Governor"
        );
      });
    });

    describe.only("Net Value Lost Threshold", () => {
      beforeEach(async () => {
        _destructureFixture(await activePositionFixture());
      });

      const _setNetLossVal = async (val) => {
        const netLostValueStorageSlot = BigNumber.from(169).toHexString();
        const expectedVal = BigNumber.from(val)

        const byte32Val = expectedVal.toHexString(val).replace(
          "0x", 
          "0x" + (new Array(64 - (expectedVal.toHexString().length - 2)).fill("0").join(""))
        )
        await hre.network.provider.send("hardhat_setStorageAt", [
          strategy.address,
          netLostValueStorageSlot,
          // Set an higher lost value manually
          byte32Val
        ])
        expect(await strategy.netLostValue()).to.equal(
          expectedVal,
          "Storage slot changed?"
        )
      }

      it.skip("Should update lost value of position during mint/increase", async () => {

        // for (let i = 150; i <= 200; i++) {
        //   const val = await hre.network.provider.send("eth_getStorageAt", [
        //     strategy.address,
        //     BigNumber.from(i).toHexString(),
        //     "latest"
        //   ])

        //   console.log(i, val)
        // }
      });

      it("Should update lost value when collecting fees", async () => {
        await _setNetLossVal(ousdUnits("1000")) // $1000
        const tokenId = await strategy.activeTokenId();

        await mockPositionManager.setTokensOwed(
          tokenId,
          usdcUnits("330"), // $330
          usdtUnits("120"), // $120
        )
        await strategy.collectFees()

        expect(await strategy.netLostValue()).to.equal(
          BigNumber.from(ousdUnits("550"))
        )
      });

      it("Should reset lost value when collecting huge fees", async () => {
        await _setNetLossVal(ousdUnits("1000")) // $1000
        const tokenId = await strategy.activeTokenId();

        await mockPositionManager.setTokensOwed(
          tokenId,
          usdcUnits("4000"), // $4000
          usdtUnits("5000"), // $5000
        )
        await strategy.collectFees()

        expect(await strategy.netLostValue()).to.equal(
          BigNumber.from("0")
        )
      });

      it("Should allow close/withdraw beyond threshold", async () => {
        await _setNetLossVal("999999999999999999999999999999999999999999999")

        const tokenId = await strategy.activeTokenId();

        await expect(
          strategy
            .connect(operator)
            .closePosition(
              tokenId,
              "0",
              "0"
            )
        ).to.not.be.reverted
        
        expect(await strategy.activeTokenId()).to.not.equal(tokenId)
      });

      it("Should revert if beyond threshold (during mint)", async () => {
        await _setNetLossVal("999999999999999999999999999999999999999999999")

        await expect(
          strategy
            .connect(operator)
            .rebalance(
              "1",
              "1",
              "0",
              "0",
              "0",
              "0",
              "-120",
              "1234"
            )
        ).to.be.revertedWith(
          "Over max value loss threshold"
        )
      });

      it("Should revert if beyond threshold (when increasing liquidity)", async () => {
        await _setNetLossVal("999999999999999999999999999999999999999999999")

        await expect(
          strategy
            .connect(operator)
            .increaseActivePositionLiquidity(
              "1",
              "1",
              "0",
              "0"
            )
        ).to.be.revertedWith(
          "Over max value loss threshold"
        )
      });
    });
  });
});
