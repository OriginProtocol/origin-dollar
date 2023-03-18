const { expect } = require("chai");
const { uniswapV3FixturSetup } = require("../_fixture");
const { units, ousdUnits, expectApproxSupply } = require("../helpers");

const uniswapV3Fixture = uniswapV3FixturSetup();

describe("Uniswap V3 Strategy", function () {
  let fixture;
  let vault, ousd, usdc, usdt, dai;
  let reserveStrategy,
    strategy,
    // mockPool,
    // mockPositionManager,
    mockStrategy2,
    mockStrategyDAI;
  let governor, strategist, operator, josh, matt, daniel, domen, franck;

  beforeEach(async () => {
    fixture = await uniswapV3Fixture();
    reserveStrategy = fixture.mockStrategy;
    mockStrategy2 = fixture.mockStrategy2;
    mockStrategyDAI = fixture.mockStrategyDAI;
    strategy = fixture.UniV3_USDC_USDT_Strategy;
    // mockPool = fixture.UniV3_USDC_USDT_Pool;
    // mockPositionManager = fixture.UniV3PositionManager;
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

  const mint = async (user, amount, asset) => {
    await asset.connect(user).mint(units(amount, asset));
    await asset.connect(user).approve(vault.address, units(amount, asset));
    await vault.connect(user).mint(asset.address, units(amount, asset), 0);
  };

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
    it.skip("Should mint new position");
    it.skip("Should increase liquidity for active position");
    it.skip("Should close active position");
    it.skip("Should rebalance");
    it.skip("Should swap USDC for USDT and then rebalance");
    it.skip("Should swap USDT for USDC and then rebalance");
  });

  // describe("Rewards", function () {
  //   it("Should show correct amount of fees", async () => {});
  // });
  // describe("Rebalance", function () {
  //   it("Should provide liquidity on given tick", async () => {});
  //   it("Should close existing position", async () => {});
  // });
});
