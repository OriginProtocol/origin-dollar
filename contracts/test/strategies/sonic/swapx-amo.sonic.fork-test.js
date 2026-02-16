const { swapXAMOFixture } = require("../../_fixture-sonic");
const addresses = require("../../../utils/addresses");
const { shouldBehaveLikeAlgebraAmoStrategy } = require("../../behaviour/algebraAmoStrategy");
const { createFixtureLoader } = require("../../_fixture");

describe.only("Sonic Fork Test: Sonic Staking Strategy", function () {
  shouldBehaveLikeAlgebraAmoStrategy(async() => {
    const fixture = await swapXAMOFixture();
    return {
      fixture: swapXAMOFixture,
      loadFixture: ({
        assetMintAmount = 0,
        depositToStrategy = false,
        balancePool = false,
        poolAddAssetAmount = 0,
        poolAddOTokenAmount = 0
      } = {}) => {
        return createFixtureLoader(swapXAMOFixture, {
          wsMintAmount: assetMintAmount,
          depositToStrategy,
          balancePool,
          poolAddwSAmount: poolAddAssetAmount,
          poolAddOSAmount: poolAddOTokenAmount
        });
      },
      addresses: addresses.sonic,
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
      oTokenPoolIndex: 1, // index of the oToken in the pool
      vaultSigner: fixture.oSonicVaultSigner, // address of the vault signer
      vault: fixture.oSonicVault, // address of the vault
      harvester: fixture.harvester, // address of the harvester
    };
  });
});