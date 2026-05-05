const { expect } = require("chai");

const addresses = require("../../../utils/addresses");
const { createFixtureLoader } = require("../../_fixture");
const { oethbHydrexAMOFixture } = require("../../_fixture-base");
const {
  shouldBehaveLikeAlgebraAmoStrategy,
} = require("../../behaviour/algebraAmoStrategy");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Base Fork Test: OETHb Hydrex AMO Strategy", function () {
  // Verify the bring-up that 048_oethb_hydrex_amo performs. If the deploy
  // script regresses, these fail loudly with a clear message rather than
  // surfacing as some downstream behavior-suite assertion.
  describe("deploy script wires the strategy correctly", function () {
    let fixture;
    before(async () => {
      const fixtureLoader = await createFixtureLoader(oethbHydrexAMOFixture);
      fixture = await fixtureLoader();
    });

    it("Strategy.pool() matches addresses.base.HydrexOETHb_WETH.pool", async () => {
      expect(fixture.hydrexPool.address.toLowerCase()).to.equal(
        addresses.base.HydrexOETHb_WETH.pool.toLowerCase()
      );
    });

    it("Strategy.gauge() is non-zero", async () => {
      expect(fixture.hydrexGauge.address).to.not.equal(ZERO_ADDRESS);
    });

    it("Strategy.harvesterAddress() is the multichain strategist", async () => {
      expect(await fixture.hydrexAMOStrategy.harvesterAddress()).to.equal(
        addresses.base.multichainStrategist
      );
    });

    it("OETHBase Vault has approved the strategy", async () => {
      const strategyConfig = await fixture.oethbVault.strategies(
        fixture.hydrexAMOStrategy.address
      );
      expect(strategyConfig.isSupported).to.equal(true);
    });

    it("OETHBase Vault has the strategy on the mint whitelist", async () => {
      expect(
        await fixture.oethbVault.isMintWhitelistedStrategy(
          fixture.hydrexAMOStrategy.address
        )
      ).to.equal(true);
    });
  });

  shouldBehaveLikeAlgebraAmoStrategy(async () => {
    // Magnitudes are tuned ~5–10× smaller than the mainnet Supernova test
    // because the superOETHb/WETH pool starts with a much smaller bootstrap.
    // Ratios are kept the same so every behavioral branch still fires.
    const scenarioConfig = {
      attackerFrontRun: {
        moderateAssetIn: "5",
        largeAssetIn: "1000",
        largeOTokenIn: "1000",
      },
      bootstrapPool: {
        smallAssetBootstrapIn: "10",
        mediumAssetBootstrapIn: "50",
        largeAssetBootstrapIn: "50000",
      },
      mintValues: {
        extraSmall: "0.1",
        extraSmallPlus: "0.2",
        small: "1",
        medium: "2",
      },
      poolImbalance: {
        lotMoreOToken: { addOToken: 100 },
        littleMoreOToken: { addOToken: 1 },
        lotMoreAsset: { addAsset: 100 },
        littleMoreAsset: { addAsset: 1 },
      },
      smallPoolShare: {
        bootstrapAssetSwapIn: "20",
        bigLiquidityAsset: "10",
        oTokenBuffer: "20",
        stressSwapOToken: "8",
        stressSwapAsset: "12",
        stressSwapAssetAlt: "8",
      },
      rebalanceProbe: {
        frontRun: {
          depositAmount: "50",
          failedDepositAmount: "50",
          failedDepositAllAmount: "50",
          tiltSeedWithdrawAmount: "15",
          assetTiltWithdrawAmount: "10",
          oTokenTiltWithdrawAmount: "0.001",
        },
        lotMoreOToken: {
          failedDepositAmount: "50",
          partialWithdrawAmount: "4",
          smallSwapAssetsToPool: "0.3",
          largeSwapAssetsToPool: "4",
          nearMaxSwapAssetsToPool: "7",
          excessiveSwapAssetsToPool: "500",
          disallowedSwapOTokensToPool: "0.0001",
        },
        littleMoreOToken: {
          depositAmount: "3",
          partialWithdrawAmount: "2",
          smallSwapAssetsToPool: "0.3",
          excessiveSwapAssetsToPool: "12",
          disallowedSwapOTokensToPool: "0.0001",
        },
        lotMoreAsset: {
          failedDepositAmount: "15",
          partialWithdrawAmount: "2",
          smallSwapOTokensToPool: "0.03",
          largeSwapOTokensToPool: "12",
          overshootSwapOTokensToPool: "90",
          disallowedSwapAssetsToPool: "0.00001",
        },
        littleMoreAsset: {
          depositAmount: "4",
          partialWithdrawAmount: "2",
          smallSwapOTokensToPool: "0.2",
          overshootSwapOTokensToPool: "30",
          disallowedSwapAssetsToPool: "0.00001",
        },
      },
      insolvent: {
        swapOTokensToPool: "0.1",
      },
      harvest: {
        collectedBy: "strategist",
      },
    };

    return {
      scenarioConfig,
      loadFixture: async ({
        assetMintAmount = 0,
        depositToStrategy = false,
        balancePool = false,
        poolAddAssetAmount = 0,
        poolAddOTokenAmount = 0,
      } = {}) => {
        const fixtureLoader = await createFixtureLoader(oethbHydrexAMOFixture, {
          assetMintAmount,
          depositToStrategy,
          balancePool,
          poolAddWethAmount: poolAddAssetAmount,
          poolAddOethAmount: poolAddOTokenAmount,
        });

        const fixture = await fixtureLoader();
        const oTokenPoolIndex =
          (await fixture.hydrexPool.token0()) === fixture.oethb.address ? 0 : 1;

        return {
          assetToken: fixture.weth,
          oToken: fixture.oethb,
          rewardToken: fixture.hydrexRewardToken,
          amoStrategy: fixture.hydrexAMOStrategy,
          pool: fixture.hydrexPool,
          gauge: fixture.hydrexGauge,
          governor: fixture.timelock,
          timelock: fixture.timelock,
          strategist: fixture.strategist,
          nick: fixture.nick,
          oTokenPoolIndex,
          vaultSigner: fixture.oethbVaultSigner,
          vault: fixture.oethbVault,
          harvester: fixture.harvester,
          scenarioConfig,
        };
      },
    };
  });
});
