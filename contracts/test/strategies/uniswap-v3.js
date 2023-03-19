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

  beforeEach(async () => {
    fixture = await uniswapV3Fixture();
    reserveStrategy = fixture.mockStrategy;
    mockStrategy2 = fixture.mockStrategy2;
    mockStrategyDAI = fixture.mockStrategyDAI;
    strategy = fixture.UniV3_USDC_USDT_Strategy;
    helper = fixture.UniV3Helper;
    mockPool = fixture.UniV3_USDC_USDT_Pool;
    mockPositionManager = fixture.UniV3PositionManager;
    ousd = fixture.ousd;
    usdc = fixture.usdc;
    usdt = fixture.usdt;
    dai = fixture.dai;
    vault = fixture.vault;
    // harvester = fixture.harvester;
    governor = fixture.governor;
    strategist = fixture.strategist;
    operator = fixture.operator;
    josh = fixture.josh;
    matt = fixture.matt;
    daniel = fixture.daniel;
    domen = fixture.domen;
    franck = fixture.franck;
  });

  for (const assetSymbol of ["USDC", "USDT"]) {
    describe(`Mint w/ ${assetSymbol}`, function () {
      let asset;
      beforeEach(() => {
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

  describe("Balance & Fees", () => {
    describe("getPendingFees()", () => {});
    describe("checkBalance()", () => {});
    describe("checkBalanceOfAllAssets()", () => {});
  });

  describe("Admin functions", () => {
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
    beforeEach(async () => {
      fixture = await liquidityManagerFixture();
    });

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

        // Mint
        const { events } = await mintLiquidity({
          amount0: "1000000",
          amount1: "1000000",
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

        // Verify balance
        const amount0Bal = await usdc.balanceOf(strategy.address);
        const amount1Bal = await usdt.balanceOf(strategy.address);
        expect(amount0Bal).to.approxEqual(amount.sub(amount0Deposited));
        expect(amount1Bal).to.approxEqual(amount.sub(amount1Deposited));
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
        await strategy.connect(governor).setMaxTVL(await ousdUnits("100000"));

        expect(
          strategy
            .connect(operator)
            .rebalance(
              await units("100000", 18),
              await units("100000", 18),
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
              await units("100000", 18),
              await units("100000", 18),
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
          await strategy
            .connect(user)
            .increaseActivePositionLiquidity("1", "1", "0", "0");
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
      it("Should close active position during a mint", async () => {});

      it("Should close active position", async () => {});

      it("Should liquidate active position during withdraw", async () => {});

      it("Should liquidate active position during withdrawAll", async () => {});

      it("Should revert if caller isn't Governor/Strategist/Operator", async () => {});
    });

    describe("Swap And Rebalance", () => {
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
      it("Should accrue and collect fees", async () => {});
    });

    describe("Net Value Lost Threshold", () => {
      it("Should update threshold when value changes", async () => {});

      it("Should update threshold when collecting fees", async () => {});

      it("Should allow close/withdraw beyond threshold", async () => {});

      it("Should revert if beyond threshold (during mint)", async () => {});

      it("Should revert if beyond threshold (when increasing liquidity)", async () => {});
    });
  });
});
