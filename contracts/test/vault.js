const { expect } = require("chai");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdtUnits,
  usdUnits,
  expectBalance,
} = require("./helpers");

describe("Vault", function () {
  it("Should error when adding a market that already exists", async function () {
    const { vault, usdt } = await waffle.loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.reverted;
  });

  it("Should deprecate an asset");

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdt, dai, matt } = await waffle.loadFixture(
      defaultFixture
    );

    await expectBalance(ousd, matt, ousdUnits("100.0"), "Initial");

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("2.0"));
    await vault.connect(matt).depositAndMint(usdt.address, usdtUnits("2.0"));
    await expectBalance(ousd, matt, ousdUnits("102.0"));

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).depositAndMint(dai.address, daiUnits("4.0"));
    await expectBalance(ousd, matt, ousdUnits("106.0"));
  });

  it("Should correctly handle a deposit of DAI (18 digits)", async function () {
    const { ousd, vault, dai, anna, oracle } = await waffle.loadFixture(
      defaultFixture
    );
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 3 DAI worth $2 each, she should have $6 OUSD.
    await oracle.setPrice("DAI", usdUnits("2.00"));
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).depositAndMint(dai.address, daiUnits("3.0"));
    await expectBalance(ousd, anna, ousdUnits("6.0"));
  });

  it("Should correctly handle a deposit of USDT (6 digits)", async function () {
    const { ousd, vault, usdt, anna, oracle } = await waffle.loadFixture(
      defaultFixture
    );
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 50 USDT worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDT", usdUnits("3.00"));
    await usdt.connect(anna).approve(vault.address, usdtUnits("50.0"));
    await vault.connect(anna).depositAndMint(usdt.address, usdtUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("150.0"));
  });

  it("Should increase the totalBalance of the deposited asset");

  it("Should mint the correct amount of OUSD for varying priced assets");
});
