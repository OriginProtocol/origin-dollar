const { forkOnlyDescribe } = require("../helpers");
const { createFixtureLoader, lensFixture } = require("../_fixture");

const loadFixture = createFixtureLoader(lensFixture);

forkOnlyDescribe("Fork Test: OriginLens", () => {
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should return Balancer rETH strategy balance", async () => {
    const { lens } = fixture;
    const [assets, balances] = await lens.getStrategyBalances(
      "0x49109629aC1deB03F2e9b2fe2aC4a623E0e7dfDC"
    );
    console.log(
      assets,
      balances.map((x) => x.toString())
    );
  });
  it("Should return Curve AMO strategy balance", async () => {
    const { lens } = fixture;
    const [assets, balances] = await lens.getStrategyBalances(
      "0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63"
    );
    console.log(
      assets,
      balances.map((x) => x.toString())
    );
  });
});
