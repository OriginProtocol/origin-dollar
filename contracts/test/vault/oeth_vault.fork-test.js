const { expect } = require("chai");
const { parseUnits, formatUnits } = require("ethers/lib/utils");

const {
  defaultFixtureSetup,
  oethDefaultFixtureSetup,
  oethCollateralSwapFixtureSetup,
  impersonateAccount,
} = require("./../_fixture");
const { getIInchSwapData, recodeSwapData } = require("../../utils/1Inch");
const addresses = require("../../utils/addresses");
const { forkOnlyDescribe } = require("../helpers");
const { resolveAsset } = require("../../utils/assets");

const log = require("../../utils/logger")("test:fork:oeth:vault");

const defaultFixture = oethDefaultFixtureSetup();
const collateralSwapFixture = oethCollateralSwapFixtureSetup();

const oethWhaleAddress = "0xEADB3840596cabF312F2bC88A4Bb0b93A4E1FF5F";

forkOnlyDescribe("ForkTest: OETH Vault", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  // this.retries(3);

  let fixture;

  after(async () => {
    // This is needed to revert fixtures
    // The other tests as of now don't use proper fixtures
    // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
    const f = defaultFixtureSetup();
    await f();
  });

  describe("OETH Vault", () => {
    describe("user operations", () => {
      let oethWhaleSigner;
      beforeEach(async () => {
        fixture = await collateralSwapFixture();

        await impersonateAccount(oethWhaleAddress);
        oethWhaleSigner = await ethers.provider.getSigner(oethWhaleAddress);
      });

      it("should mint using each asset", async () => {
        const { oethVault, weth, frxETH, stETH, reth, josh } = fixture;

        const amount = parseUnits("1", 18);
        const minOeth = parseUnits("0.8", 18);

        for (const asset of [weth, frxETH, stETH, reth]) {
          await asset.connect(josh).approve(oethVault.address, amount);
          const tx = await oethVault
            .connect(josh)
            .mint(asset.address, amount, minOeth);

          if (asset === weth || asset === frxETH) {
            await expect(tx)
              .to.emit(oethVault, "Mint")
              .withArgs(josh.address, amount);
          } else {
            // Oracle price means 1 asset != 1 OETH
            await expect(tx)
              .to.emit(oethVault, "Mint")
              .withNamedArgs({ _addr: josh.address });
          }
        }
      });
      it("should partially redeem", async () => {
        const { oeth, oethVault, matt } = fixture;

        expect(await oeth.balanceOf(matt.address)).to.gt(10);

        const amount = parseUnits("10", 18);
        const minEth = parseUnits("9.94", 18);

        const tx = await oethVault.connect(matt).redeem(amount, minEth);
        await expect(tx)
          .to.emit(oethVault, "Redeem")
          .withNamedArgs({ _addr: matt.address });
      });
      it("OETH whale can not full redeem due to liquidity", async () => {
        const { oeth, oethVault } = fixture;

        const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
        expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
          parseUnits("100", 18)
        );

        const tx = oethVault
          .connect(oethWhaleSigner)
          .redeem(oethWhaleBalance, 0);
        await expect(tx).to.revertedWith("Liquidity error");
      });
      it("OETH whale can redeem after withdraw from all strategies", async () => {
        const { oeth, oethVault, timelock } = fixture;

        const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
        expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
          parseUnits("100", 18)
        );

        await oethVault.connect(timelock).withdrawAllFromStrategies();

        const tx = await oethVault
          .connect(oethWhaleSigner)
          .redeem(oethWhaleBalance, 0);
        await expect(tx)
          .to.emit(oethVault, "Redeem")
          .withNamedArgs({ _addr: oethWhaleAddress });
      });
      it("OETH whale redeem 100 OETH", async () => {
        const { oethVault } = fixture;

        const amount = parseUnits("100", 18);
        const minEth = parseUnits("99.4", 18);

        const tx = await oethVault
          .connect(oethWhaleSigner)
          .redeem(amount, minEth);
        await expect(tx)
          .to.emit(oethVault, "Redeem")
          .withNamedArgs({ _addr: oethWhaleAddress });
      });
    });
    describe("post swap deployment", () => {
      beforeEach(async () => {
        fixture = await defaultFixture();
      });

      it("Should have the correct governor address set", async () => {
        const {
          oethVault,
          oethDripper,
          ConvexEthMetaStrategy,
          fraxEthStrategy,
          oeth,
          woeth,
          oethHarvester,
        } = fixture;

        const oethContracts = [
          oethVault,
          oethDripper,
          ConvexEthMetaStrategy,
          fraxEthStrategy,
          oeth,
          woeth,
          oethHarvester,
        ];

        for (let i = 0; i < oethContracts.length; i++) {
          expect(await oethContracts[i].governor()).to.equal(
            addresses.mainnet.Timelock
          );
        }
      });
      it("should have swapper set", async () => {
        const { oethVault, swapper } = fixture;

        expect(await oethVault.swapper()).to.equal(swapper.address);
      });
      it("assets should have allowed slippage", async () => {
        const { oethVault, weth, reth, stETH, frxETH } = fixture;

        const assets = [weth, stETH, reth, frxETH];
        const expectedConversions = [0, 0, 1, 0];
        const expectedSlippage = [20, 70, 200, 20];

        for (let i = 0; i < assets.length; i++) {
          const config = await oethVault.getAssetConfig(assets[i].address);

          expect(config.decimals, `decimals ${i}`).to.equal(18);
          expect(config.isSupported, `isSupported ${i}`).to.be.true;
          expect(config.unitConversion, `unitConversion ${i}`).to.be.equal(
            expectedConversions[i]
          );
          expect(
            config.allowedOracleSlippageBps,
            `allowedOracleSlippageBps ${i}`
          ).to.equal(expectedSlippage[i]);
        }
      });
    });

    const assertSwap = async ({
      fromAsset,
      toAsset,
      fromAmount,
      minToAssetAmount,
      slippage,
      protocols,
      approxFromBalance,
    }) => {
      const { oethVault, strategist, swapper } = fixture;

      fromAmount = parseUnits(fromAmount.toString(), 18);
      minToAssetAmount = parseUnits(minToAssetAmount.toString(), 18);

      const apiEncodedData = await getIInchSwapData({
        vault: oethVault,
        fromAsset,
        toAsset,
        fromAmount,
        slippage,
        protocols,
      });

      // re-encode the 1Inch tx.data from their swap API to the executer data
      const swapData = await recodeSwapData(apiEncodedData);

      const fromBalanceBefore = await fromAsset.balanceOf(oethVault.address);
      log(`from asset balance before ${formatUnits(fromBalanceBefore, 18)}`);
      const toBalanceBefore = await toAsset.balanceOf(oethVault.address);

      const tx = oethVault
        .connect(strategist)
        .swapCollateral(
          fromAsset.address,
          toAsset.address,
          fromAmount,
          minToAssetAmount,
          swapData
        );

      // Asset events
      await expect(tx).to.emit(oethVault, "Swapped").withNamedArgs({
        _fromAsset: fromAsset.address,
        _toAsset: toAsset.address,
        _fromAssetAmount: fromAmount,
      });
      await expect(tx)
        .to.emit(fromAsset, "Transfer")
        .withArgs(oethVault.address, swapper.address, fromAmount);

      // Asset balances
      const fromBalanceAfter = await fromAsset.balanceOf(oethVault.address);
      if (approxFromBalance) {
        expect(
          fromBalanceBefore.sub(fromBalanceAfter),
          "from asset approx bal"
        ).to.approxEqualTolerance(fromAmount, 0.01);
      } else {
        expect(fromBalanceBefore.sub(fromBalanceAfter), "from asset bal").to.eq(
          fromAmount
        );
      }
      const toBalanceAfter = await toAsset.balanceOf(oethVault.address);
      log(
        `to assets purchased ${formatUnits(
          toBalanceAfter.sub(toBalanceBefore),
          18
        )}`
      );
      expect(toBalanceAfter.sub(toBalanceBefore), "to asset bal").to.gt(
        minToAssetAmount
      );
    };
    const assertFailedSwap = async ({
      fromAsset,
      toAsset,
      fromAmount,
      minToAssetAmount,
      slippage,
      protocols,
      error,
    }) => {
      const { oethVault, strategist } = fixture;

      fromAmount = parseUnits(fromAmount.toString(), 18);
      minToAssetAmount = parseUnits(minToAssetAmount.toString(), 18);

      const apiEncodedData = await getIInchSwapData({
        vault: oethVault,
        fromAsset,
        toAsset,
        fromAmount,
        slippage,
        protocols,
      });

      // re-encode the 1Inch tx.data from their swap API to the executer data
      const swapData = await recodeSwapData(apiEncodedData);

      const tx = oethVault
        .connect(strategist)
        .swapCollateral(
          fromAsset.address,
          toAsset.address,
          fromAmount,
          minToAssetAmount,
          swapData
        );

      await expect(tx).to.be.revertedWith(error);
    };

    describe("Collateral swaps", async () => {
      beforeEach(async () => {
        fixture = await collateralSwapFixture();
      });

      const tests = [
        {
          from: "WETH",
          to: "rETH",
          fromAmount: 100,
          minToAssetAmount: 92,
        },
        {
          from: "WETH",
          to: "stETH",
          fromAmount: 100,
          minToAssetAmount: 99.99,
        },
        {
          from: "WETH",
          to: "frxETH",
          fromAmount: 100,
          minToAssetAmount: 100,
        },
        {
          from: "rETH",
          to: "stETH",
          fromAmount: 10,
          minToAssetAmount: "10.73",
          slippage: 0.1,
        },
        {
          from: "rETH",
          to: "frxETH",
          fromAmount: 10,
          minToAssetAmount: 10.7,
          slippage: 0.1,
        },
        {
          from: "rETH",
          to: "WETH",
          fromAmount: 10,
          minToAssetAmount: "10.7",
          slippage: 0.1,
        },
        {
          from: "stETH",
          to: "rETH",
          fromAmount: 400,
          minToAssetAmount: 350,
          approxFromBalance: true,
        },
        {
          from: "stETH",
          to: "frxETH",
          fromAmount: 400,
          minToAssetAmount: 399.1,
          approxFromBalance: true,
        },
        {
          from: "stETH",
          to: "WETH",
          fromAmount: 750,
          minToAssetAmount: 749.1,
          approxFromBalance: true,
        },
        {
          from: "frxETH",
          to: "rETH",
          fromAmount: 25,
          minToAssetAmount: 23,
        },
        {
          from: "frxETH",
          to: "stETH",
          fromAmount: 25,
          minToAssetAmount: 24.9,
        },
        {
          from: "frxETH",
          to: "WETH",
          fromAmount: 25,
          minToAssetAmount: 24.9,
        },
        {
          from: "WETH",
          to: "stETH",
          fromAmount: 1,
          minToAssetAmount: 0.9,
          protocols: "UNISWAP_V2",
        },
        {
          from: "WETH",
          to: "frxETH",
          fromAmount: 100,
          minToAssetAmount: 99.9,
          protocols: "UNISWAP_V3",
        },
        {
          from: "WETH",
          to: "rETH",
          fromAmount: 100,
          minToAssetAmount: 90,
          protocols: "ROCKET_POOL",
        },
        {
          from: "WETH",
          to: "frxETH",
          fromAmount: 100,
          minToAssetAmount: 100,
          protocols: "CURVE,CURVE_V2",
        },
        {
          from: "WETH",
          to: "stETH",
          fromAmount: 100,
          minToAssetAmount: 99.999,
          protocols: "ST_ETH",
        },
        {
          from: "stETH",
          to: "frxETH",
          fromAmount: 750,
          minToAssetAmount: 749.2,
          protocols: "ST_ETH,CURVE,CURVE_V2,MAVERICK_V1",
          approxFromBalance: true,
        },
        {
          from: "rETH",
          to: "frxETH",
          fromAmount: 100,
          minToAssetAmount: 107.2,
          protocols:
            "BALANCER,BALANCER_V2,BALANCER_V2_WRAPPER,CURVE,CURVE_V2,MAVERICK_V1",
        },
      ];
      for (const test of tests) {
        it(`should be able to swap ${test.fromAmount} ${test.from} for ${
          test.to
        } using ${test.protocols || "all"} protocols`, async () => {
          const fromAsset = await resolveAsset(test.from);
          const toAsset = await resolveAsset(test.to);
          await assertSwap({
            ...test,
            fromAsset,
            toAsset,
          });
        });
      }
    });

    describe("Collateral swaps", async () => {
      beforeEach(async () => {
        fixture = await collateralSwapFixture();
      });

      const tests = [
        {
          error: "",
          from: "WETH",
          to: "frxETH",
          fromAmount: 100,
          minToAssetAmount: 105,
        },
        {
          error: "",
          from: "WETH",
          to: "stETH",
          fromAmount: 100,
          minToAssetAmount: 90,
          protocols: "UNISWAP_V3",
        },
        {
          error: "Oracle slippage limit exceeded",
          from: "WETH",
          to: "stETH",
          fromAmount: 100,
          minToAssetAmount: 90,
          protocols: "UNISWAP_V2",
        },
        {
          error: "To asset is not supported",
          from: "WETH",
          to: "USDT",
          fromAmount: 20,
          minToAssetAmount: 1,
        },
        {
          error: "ERC20: transfer amount exceeds balance",
          from: "frxETH",
          to: "WETH",
          fromAmount: 1000,
          minToAssetAmount: 990,
        },
        {
          error: "SafeERC20: low-level call failed",
          from: "WETH",
          to: "frxETH",
          fromAmount: 3000,
          minToAssetAmount: 2990,
        },
        {
          error: "BALANCE_EXCEEDED",
          from: "stETH",
          to: "WETH",
          fromAmount: 10000,
          minToAssetAmount: 9900,
        },
        {
          error: "ERC20: transfer amount exceeds balance",
          from: "rETH",
          to: "WETH",
          fromAmount: 10000,
          minToAssetAmount: 9900,
        },
      ];

      for (const test of tests) {
        it(`should fail to swap ${test.fromAmount} ${test.from} for ${
          test.to
        } using ${test.protocols || "all"} protocols: error ${
          test.error
        }`, async () => {
          const fromAsset = await resolveAsset(test.from);
          const toAsset = await resolveAsset(test.to);
          await assertFailedSwap({
            ...test,
            fromAsset,
            toAsset,
          });
        });
      }
    });
  });
});
