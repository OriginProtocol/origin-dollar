const {
  createFixtureLoader,
  morphoCollectorModuleFixture,
} = require("../_fixture");
const { expect } = require("chai");

const loadFixture = createFixtureLoader(morphoCollectorModuleFixture);

describe("ForkTest: Morpho Collector Safe Module", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should claim Morpho rewards", async () => {
    const { morphoCollectorModule, safeSigner, morphoToken } = fixture;

    const morphoBalance = await morphoToken.balanceOf(safeSigner.address);

    await morphoCollectorModule.connect(safeSigner).claimRewards();

    const morphoBalanceAfter = await morphoToken.balanceOf(safeSigner.address);
    expect(morphoBalanceAfter).to.gt(morphoBalance);
  });
});
