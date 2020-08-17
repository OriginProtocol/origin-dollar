const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");

describe("Vault", function () {
  beforeEach(async () => {
    await deployments.fixture();
  });

  it("Should error when adding a market that already exists", async function () {
    const { vault, usdt } = await waffle.loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.reverted;
  });

  it("Should deprecate an asset", async function () {});

  it("Should correctly ratio deposited currencies of differing decimals", async function () {});

  it("Should increase the totalBalance of the deposited asset", async function () {});

  it("Should mint the correct amount of OUSD for varying priced assets", async function () {});
});
