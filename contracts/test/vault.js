const { expect } = require("chai");
const {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  daiUnits,
  tusdUnits,
  defaultFixture,
  expectBalance,
} = require("./_fixture");

describe("Vault", function () {
  it("Should error when adding a market that already exists", async function () {
    const { vault, usdt } = await waffle.loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.reverted;
  });

  it("Should deprecate an asset", async function () {});

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdt, dai, matt } = await waffle.loadFixture(
      defaultFixture
    );

    await expectBalance(ousd, matt, ousdUnits("100.0"));

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("2.0"));
    await vault.connect(matt).depositAndMint(usdt.address, usdtUnits("2.0"));
    await expectBalance(ousd, matt, ousdUnits("102.0"));

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).depositAndMint(dai.address, daiUnits("4.0"));
    await expectBalance(ousd, matt, ousdUnits("106.0"));
  });

  it("Should increase the totalBalance of the deposited asset", async function () {});

  it("Should mint the correct amount of OUSD for varying priced assets", async function () {});
});
