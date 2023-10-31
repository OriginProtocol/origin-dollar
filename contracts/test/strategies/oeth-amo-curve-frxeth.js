const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { shouldBehaveLikeAmo } = require("../behaviour/amo");
const {
  convexFrxEthAmoFixture,
  createFixtureLoader,
} = require("../fixture/_fixture");
const { isFork } = require("../helpers");

describe("Convex frxETH/OETH AMO Strategy", function () {
  if (isFork) {
    this.timeout(0);
  } else {
    this.timeout(600000);
  }

  const loadFixture = createFixtureLoader(convexFrxEthAmoFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.convexFrxETHAMOStrategy,
  }));

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    strategy: fixture.convexFrxETHAMOStrategy,
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
    strategy: fixture.convexFrxETHAMOStrategy,
    assets: [fixture.frxETH],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  shouldBehaveLikeAmo(() => ({
    ...fixture,
    strategy: fixture.convexFrxETHAMOStrategy,
    oToken: fixture.oeth,
    vaultAsset: fixture.frxETH,
    poolAssetAddress: fixture.frxETH.address,
    pool: fixture.curveFrxEthOethPool,
    vault: fixture.oethVault,
    assetDivisor: 1,
  }));

  describe("Utilities", function () {
    it("Should not initialize a second time", async () => {
      const { convexFrxETHAMOStrategy, governor } = fixture;
      await expect(
        convexFrxETHAMOStrategy.connect(governor).initialize([], [], [])
      ).to.revertedWith("Initializable: contract is already initialized");
    });
  });
});
