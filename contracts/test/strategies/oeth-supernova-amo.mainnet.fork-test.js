const { supernovaOETHAMOFixure, createFixtureLoader } = require("../_fixture");
const addresses = require("../../utils/addresses");
const { shouldBehaveLikeAlgebraAmoStrategy } = require("../behaviour/algebraAmoStrategy");

describe("Mainnet Fork Test: OETH Supernova AMO Strategy", function () {
  shouldBehaveLikeAlgebraAmoStrategy(async () => {
    const scenarioConfig = {
      attackerFrontRun: {
        moderateAssetIn: "20",
        largeAssetIn: "10000",
        largeOTokenIn: "10000",
      },
      bootstrapPool:{
        smallAssetBootstrapIn: "50",
        mediumAssetBootstrapIn: "200",
        largeAssetBootstrapIn: "500000",
      },
      mintValues:{
        extraSmall: "0.1",
        extraSmallPlus: "0.2",
        small: "1",
        medium: "2",
      },
      poolImbalance: {
        lotMoreOToken: { addOToken: 400 },
        littleMoreOToken: { addOToken: 2 },
        lotMoreAsset: { addAsset: 400 },
        littleMoreAsset: { addAsset: 2 },
      },
      smallPoolShare: {
        bootstrapAssetSwapIn: "100",
        bigLiquidityAsset: "50",
        oTokenBuffer: "100",
        stressSwapOToken: "30",
        stressSwapAsset: "50",
        stressSwapAssetAlt: "30",
      },
      rebalanceProbe: {
        frontRun: {
          depositAmount: "200",
          failedDepositAmount: "200",
          failedDepositAllAmount: "200",
          tiltSeedWithdrawAmount: "60",
          assetTiltWithdrawAmount: "40",
          oTokenTiltWithdrawAmount: "0.01",
        },
        lotMoreOToken: {
          failedDepositAmount: "200",
          partialWithdrawAmount: "40",
          smallSwapAssetsToPool: "0.3",
          largeSwapAssetsToPool: "30",
          nearMaxSwapAssetsToPool: "44",
          excessiveSwapAssetsToPool: "2000",
          disallowedSwapOTokensToPool: "0.0001",
        },
        littleMoreOToken: {
          depositAmount: "120",
          partialWithdrawAmount: "10",
          smallSwapAssetsToPool: "0.3",
          excessiveSwapAssetsToPool: "50",
          disallowedSwapOTokensToPool: "0.0001",
        },
        lotMoreAsset: {
          failedDepositAmount: "60",
          partialWithdrawAmount: "10",
          smallSwapOTokensToPool: "0.03",
          largeSwapOTokensToPool: "50",
          overshootSwapOTokensToPool: "999",
          disallowedSwapAssetsToPool: "0.00001",
        },
        littleMoreAsset: {
          depositAmount: "180",
          partialWithdrawAmount: "10",
          smallSwapOTokensToPool: "0.8",
          overshootSwapOTokensToPool: "110",
          disallowedSwapAssetsToPool: "0.00001",
        },
      },
      insolvent: {
        swapOTokensToPool: "0.1",
      },
    };

    return {
      skipHarvesterTest: true,
      scenarioConfig,
      loadFixture: async ({
        assetMintAmount = 0,
        depositToStrategy = false,
        balancePool = false,
        poolAddAssetAmount = 0,
        poolAddOTokenAmount = 0,
      } = {}) => {
        const fixtureLoader = await createFixtureLoader(supernovaOETHAMOFixure, {
          assetMintAmount,
          depositToStrategy,
          balancePool,
          poolAddWethAmount: poolAddAssetAmount,
          poolAddOethAmount: poolAddOTokenAmount,
        });

        const fixture = await fixtureLoader();
        const oTokenPoolIndex =
          (await fixture.supernovaPool.token0()) === fixture.oeth.address ? 0 : 1;

        return {
          addresses: addresses.mainnet,
          assetToken: fixture.weth,
          oToken: fixture.oeth,
          rewardToken: fixture.supernovaRewardToken,
          amoStrategy: fixture.supernovaAMOStrategy,
          pool: fixture.supernovaPool,
          gauge: fixture.supernovaGauge,
          governor: fixture.timelock,
          timelock: fixture.timelock,
          strategist: fixture.strategist,
          nick: fixture.josh,
          oTokenPoolIndex,
          vaultSigner: fixture.oethVaultSigner,
          vault: fixture.oethVault,
          harvester: fixture.oethHarvester,
          skipHarvesterTest: true,
          scenarioConfig,
        };
      },
    };
  });
});
