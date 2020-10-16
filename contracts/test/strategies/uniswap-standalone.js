const { uniswapFixture } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe("Uniswap Strategy Standalone", function () {
  this.timeout(400000000000000);

  let uniswapStrategy, uniswapStandalone, governor;

  beforeEach(async function () {
    const fixture = await loadFixture(uniswapFixture);
    governor = fixture.governor;

    uniswapStandalone = fixture.uniswapStandalone;

    uniswapStrategy = uniswapStandalone.connect(governor);
  });

  it("should add uniswap strategy", async () => {
    const result = await uniswapStrategy.sample();
    console.log("called;", { result: result.toString() });
  });
});
