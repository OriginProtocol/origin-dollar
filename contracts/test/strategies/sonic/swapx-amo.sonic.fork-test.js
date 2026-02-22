const { swapXAMOFixture } = require("../../_fixture-sonic");
const {
  shouldBehaveLikeAlgebraAmoStrategy,
} = require("../../behaviour/algebraAmoStrategy");
const { createFixtureLoader } = require("../../_fixture");

describe("Sonic Fork Test: SwapX AMO Strategy", function () {
  shouldBehaveLikeAlgebraAmoStrategy(async () => {
    const scenarioConfig = {
      attackerFrontRun: {
        moderateAssetIn: "20000",
        largeAssetIn: "10000000",
        largeOTokenIn: "10000000",
      },
      bootstrapPool: {
        smallAssetBootstrapIn: "5000",
        mediumAssetBootstrapIn: "20000",
        largeAssetBootstrapIn: "5000000",
      },
      mintValues: {
        extraSmall: "50",
        extraSmallPlus: "100",
        small: "2000",
        medium: "5000",
      },
      poolImbalance: {
        lotMoreOToken: { addOToken: 1000000 },
        littleMoreOToken: { addOToken: 5000 },
        lotMoreAsset: { addAsset: 2000000 },
        littleMoreAsset: { addAsset: 20000 },
      },
      smallPoolShare: {
        bootstrapAssetSwapIn: "10000000",
        bigLiquidityAsset: "1000000",
        oTokenBuffer: "2000000",
        stressSwapOToken: "1005000",
        stressSwapAsset: "2000000",
        stressSwapAssetAlt: "1006000",
      },
      rebalanceProbe: {
        frontRun: {
          depositAmount: "200000",
          failedDepositAmount: "5000",
          failedDepositAllAmount: "5000",
          tiltSeedWithdrawAmount: "6000",
          assetTiltWithdrawAmount: "4000",
          oTokenTiltWithdrawAmount: "200",
        },
        lotMoreOToken: {
          failedDepositAmount: "5000",
          partialWithdrawAmount: "4000",
          smallSwapAssetsToPool: "3",
          largeSwapAssetsToPool: "3000",
          nearMaxSwapAssetsToPool: "4400",
          excessiveSwapAssetsToPool: "2000000",
          disallowedSwapOTokensToPool: "0.001",
        },
        littleMoreOToken: {
          depositAmount: "12000",
          partialWithdrawAmount: "1000",
          smallSwapAssetsToPool: "3",
          excessiveSwapAssetsToPool: "5000",
          disallowedSwapOTokensToPool: "0.001",
        },
        lotMoreAsset: {
          failedDepositAmount: "6000",
          partialWithdrawAmount: "1000",
          smallSwapOTokensToPool: "0.3",
          largeSwapOTokensToPool: "5000",
          overshootSwapOTokensToPool: "999990",
          disallowedSwapAssetsToPool: "0.0001",
        },
        littleMoreAsset: {
          depositAmount: "18000",
          partialWithdrawAmount: "1000",
          smallSwapOTokensToPool: "8",
          overshootSwapOTokensToPool: "11000",
          disallowedSwapAssetsToPool: "0.0001",
        },
      },
      insolvent: {
        swapOTokensToPool: "10",
      },
      harvest: {
        collectedBy: "harvester",
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
        const fixtureLoader = await createFixtureLoader(swapXAMOFixture, {
          wsMintAmount: assetMintAmount,
          depositToStrategy,
          balancePool,
          poolAddwSAmount: poolAddAssetAmount,
          poolAddOSAmount: poolAddOTokenAmount,
        });

        const fixture = await fixtureLoader();
        const oTokenPoolIndex =
          (await fixture.swapXPool.token0()) === fixture.oSonic.address ? 0 : 1;

        return {
          assetToken: fixture.wS, // address of the asset token in the pool
          oToken: fixture.oSonic, // address of the oToken in the pool
          rewardToken: fixture.swpx, // address of the reward token
          amoStrategy: fixture.swapXAMOStrategy, // address of the strategy
          pool: fixture.swapXPool,
          gauge: fixture.swapXGauge, // address of the gauge
          governor: fixture.governor, // address of the governor
          timelock: fixture.governor, // address of the timelock
          strategist: fixture.strategist, // address of the strategist
          nick: fixture.nick, // nick's address
          oTokenPoolIndex, // index of the oToken in the pool
          vaultSigner: fixture.oSonicVaultSigner, // address of the vault signer
          vault: fixture.oSonicVault, // address of the vault
          harvester: fixture.harvester, // address of the harvester
          scenarioConfig,
        };
      },
    };
  });
});
