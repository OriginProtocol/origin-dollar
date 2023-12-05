const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { shouldBehaveLikeAmo } = require("../behaviour/amo");
const {
  convexOethEthAmoFixture,
  createFixtureLoader,
} = require("../fixture/_fixture");
const { isFork } = require("../helpers");
const addresses = require("../../utils/addresses");
const { convex_OETH_ETH_PID } = require("../../utils/constants");

describe("Convex OETH/WETH AMO Strategy", function () {
  if (isFork) {
    this.timeout(0);
  } else {
    this.timeout(600000);
  }

  const loadFixture = createFixtureLoader(convexOethEthAmoFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.convexEthMetaStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
    dripAsset: fixture.weth,
    rewards: [
      { asset: fixture.crv, expected: parseUnits("2") },
      { asset: fixture.cvx, expected: parseUnits("3") },
    ],
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    assets: [fixture.weth],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  shouldBehaveLikeAmo(() => ({
    ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    oToken: fixture.oeth,
    vaultAsset: fixture.weth,
    poolAssetAddress: addresses.ETH,
    assetIndex: 0,
    curvePool: fixture.curveOethEthPool,
    vault: fixture.oethVault,
    assetDivisor: 1,
    convexPID: convex_OETH_ETH_PID,
  }));

  describe("Utilities", function () {
    it("Should not initialize a second time", async () => {
      const { convexEthMetaStrategy, governor } = fixture;
      await expect(
        convexEthMetaStrategy.connect(governor).initialize([], [], [])
      ).to.revertedWith("Initializable: contract is already initialized");
    });
  });
});
