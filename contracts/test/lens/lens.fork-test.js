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
});
