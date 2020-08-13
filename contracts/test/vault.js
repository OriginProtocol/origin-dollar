const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");

describe("Vault", function () {
  beforeEach(async () => {
    await deployments.fixture();
  });

  it("Should error when adding a market that already exists", async function () {
    const { vault, usdt } = await waffle.loadFixture(defaultFixture);
    await expect(vault.createMarket(usdt.address)).to.be.reverted;
  });
});
