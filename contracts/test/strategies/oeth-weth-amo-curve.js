const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { convexOethEthAmoFixture, createFixtureLoader } = require("../_fixture");
const { isFork } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

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

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    harvester: fixture.oethHarvester,
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

  describe("Utilities", function () {
    it("Should not initialize a second time", async () => {
      const { convexEthMetaStrategy, governor } = fixture;
      await expect(
        convexEthMetaStrategy.connect(governor).initialize([], [], [])
      ).to.revertedWith("Initializable: contract is already initialized");
    });
  });
});
