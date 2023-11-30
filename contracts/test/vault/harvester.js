const { createFixtureLoader, harvesterFixture } = require("./../_fixture");
const { shouldBehaveLikeHarvester } = require("../behaviour/harvester");

const loadFixture = createFixtureLoader(harvesterFixture);

describe("Harvester", function () {
  let fixture;

  beforeEach(async () => {
    fixture = await loadFixture();
  });

  shouldBehaveLikeHarvester(() => ({
    ...fixture,
    harvester: fixture.harvester,
    strategies: [
      {
        strategy: fixture.compoundStrategy,
        rewardTokens: [fixture.comp],
      },
      {
        strategy: fixture.aaveStrategy,
        rewardTokens: [fixture.aaveToken],
      },
    ],
    rewardProceedsAddress: fixture.vault.address,
  }));
});
