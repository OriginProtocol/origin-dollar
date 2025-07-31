const { expect } = require("chai");
const { parseUnits, formatUnits } = require("ethers/lib/utils");

const {
  createFixtureLoader,
  defaultFixture,
  ousdCollateralSwapFixture,
} = require("../_fixture");
const { getIInchSwapData, recodeSwapData } = require("../../utils/1Inch");
const { decimalsFor, isCI } = require("../helpers");
const { resolveAsset } = require("../../utils/resolvers");

const log = require("../../utils/logger")("test:fork:swaps");

describe.skip("ForkTest: OUSD Vault", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("post deployment", () => {
    const loadFixture = createFixtureLoader(defaultFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("should have swapper set", async () => {
      const { vault, swapper } = fixture;

      expect(await vault.swapper()).to.equal(swapper.address);
    });
    it("assets should have allowed slippage", async () => {
      const { vault, usds, usdc, usdt } = fixture;

      const assets = [usds, usdc, usdt];
      const expectedDecimals = [18, 6, 6];
      const expectedConversions = [0, 0, 0];
      const expectedSlippage = [25, 25, 25];

      for (let i = 0; i < assets.length; i++) {
        const config = await vault.getAssetConfig(assets[i].address);

        expect(config.decimals, `decimals ${i}`).to.equal(expectedDecimals[i]);
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

  describe("Collateral swaps (Happy paths)", async () => {
    const loadFixture = createFixtureLoader(ousdCollateralSwapFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    const tests = [
      {
        from: "USDS",
        to: "USDT",
        fromAmount: 1000000,
        minToAssetAmount: 990000,
      },
      {
        from: "USDS",
        to: "USDC",
        fromAmount: 1000000,
        minToAssetAmount: 999900,
        slippage: 0.1, // Max 1Inch slippage
      },
      {
        from: "USDT",
        to: "USDS",
        fromAmount: 1000000,
        minToAssetAmount: 998000,
      },
      {
        from: "USDT",
        to: "USDC",
        fromAmount: 1000000,
        minToAssetAmount: 998000,
      },
      {
        from: "USDC",
        to: "USDS",
        fromAmount: 1000000,
        minToAssetAmount: 999900,
        slippage: 0.05, // Max 1Inch slippage
      },
      {
        from: "USDC",
        to: "USDT",
        fromAmount: 1000000,
        minToAssetAmount: "990000",
        slippage: 0.02,
        approxFromBalance: true,
      },
    ];
    for (const test of tests) {
      it(`should be able to swap ${test.fromAmount} ${test.from} for a min of ${
        test.minToAssetAmount
      } ${test.to} using ${test.protocols || "all"} protocols`, async () => {
        const fromAsset = await resolveAsset(test.from);
        const toAsset = await resolveAsset(test.to);
        await assertSwap(
          {
            ...test,
            fromAsset,
            toAsset,
            vault: fixture.vault,
          },
          fixture
        );
      });
    }
  });

  describe("Collateral swaps (Unhappy paths)", async () => {
    const loadFixture = createFixtureLoader(ousdCollateralSwapFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    const tests = [
      {
        error: "",
        from: "USDS",
        to: "USDC",
        fromAmount: 100,
        minToAssetAmount: 105,
      },
      {
        error: "From asset is not supported",
        from: "WETH",
        to: "USDT",
        fromAmount: 20,
        minToAssetAmount: 1,
      },
      {
        error: "To asset is not supported",
        from: "USDS",
        to: "WETH",
        fromAmount: 20,
        minToAssetAmount: 1,
      },
      {
        error: "Usds/insufficient-balance",
        from: "USDS",
        to: "USDC",
        fromAmount: 30000000,
        minToAssetAmount: 29000000,
      },
      {
        error: "SafeERC20: low-level call failed",
        from: "USDT",
        to: "USDC",
        fromAmount: 50000000,
        minToAssetAmount: 49900000,
      },
      {
        error: "ERC20: transfer amount exceeds balance",
        from: "USDC",
        to: "USDS",
        fromAmount: 30000000,
        minToAssetAmount: 29900000,
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
        await assertFailedSwap(
          {
            ...test,
            fromAsset,
            toAsset,
            vault: fixture.vault,
          },
          fixture
        );
      });
    }
  });
});
const assertSwap = async (
  {
    fromAsset,
    toAsset,
    fromAmount,
    minToAssetAmount,
    slippage,
    protocols,
    approxFromBalance,
    vault,
  },
  fixture
) => {
  const { strategist, swapper } = fixture;

  const fromAssetDecimals = await decimalsFor(fromAsset);
  fromAmount = await parseUnits(fromAmount.toString(), fromAssetDecimals);
  const toAssetDecimals = await decimalsFor(toAsset);
  minToAssetAmount = await parseUnits(
    minToAssetAmount.toString(),
    toAssetDecimals
  );

  const apiEncodedData = await getIInchSwapData({
    vault: vault,
    fromAsset,
    toAsset,
    fromAmount,
    slippage,
    protocols,
  });

  // re-encode the 1Inch tx.data from their swap API to the executer data
  const swapData = await recodeSwapData(apiEncodedData);

  const fromBalanceBefore = await fromAsset.balanceOf(vault.address);
  log(
    `from asset balance before ${formatUnits(
      fromBalanceBefore,
      fromAssetDecimals
    )}`
  );
  const toBalanceBefore = await toAsset.balanceOf(vault.address);

  const tx = vault
    .connect(strategist)
    .swapCollateral(
      fromAsset.address,
      toAsset.address,
      fromAmount,
      minToAssetAmount,
      swapData
    );

  // Asset events
  await expect(tx).to.emit(vault, "Swapped").withNamedArgs({
    _fromAsset: fromAsset.address,
    _toAsset: toAsset.address,
    _fromAssetAmount: fromAmount,
  });
  await expect(tx)
    .to.emit(fromAsset, "Transfer")
    .withArgs(vault.address, swapper.address, fromAmount);

  // Asset balances
  const fromBalanceAfter = await fromAsset.balanceOf(vault.address);
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
  const toBalanceAfter = await toAsset.balanceOf(vault.address);
  log(
    `to assets purchased ${formatUnits(
      toBalanceAfter.sub(toBalanceBefore),
      toAssetDecimals
    )}`
  );
  const toAmount = toBalanceAfter.sub(toBalanceBefore);
  expect(toAmount, "to asset bal").to.gt(minToAssetAmount);
  log(
    `swapped ${formatUnits(fromAmount, fromAssetDecimals)} for ${formatUnits(
      toAmount,
      toAssetDecimals
    )}`
  );
};
const assertFailedSwap = async (
  {
    fromAsset,
    toAsset,
    fromAmount,
    minToAssetAmount,
    slippage,
    protocols,
    error,
    vault,
  },
  fixture
) => {
  const { strategist } = fixture;

  const fromAssetDecimals = await decimalsFor(fromAsset);
  fromAmount = await parseUnits(fromAmount.toString(), fromAssetDecimals);
  const toAssetDecimals = await decimalsFor(toAsset);
  minToAssetAmount = parseUnits(minToAssetAmount.toString(), toAssetDecimals);

  const apiEncodedData = await getIInchSwapData({
    vault,
    fromAsset,
    toAsset,
    fromAmount,
    slippage,
    protocols,
  });

  // re-encode the 1Inch tx.data from their swap API to the executer data
  const swapData = await recodeSwapData(apiEncodedData);

  const tx = vault
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
