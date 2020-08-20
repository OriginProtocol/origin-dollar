const { expect } = require("chai");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  oracleUnits,
  expectBalance,
  loadFixture,
} = require("./helpers");

describe("Vault", function () {
  it("Should support an asset");

  it("Should error when adding an asset that is already supported", async function () {
    const { vault, usdt } = await loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.reverted;
  });

  it("Should deprecate an asset");

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdc, dai, matt } = await loadFixture(defaultFixture);

    await expectBalance(ousd, matt, ousdUnits("100.0"), "Initial");

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).depositAndMint(usdc.address, usdcUnits("2.0"));
    await expectBalance(ousd, matt, ousdUnits("102.0"));

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).depositAndMint(dai.address, daiUnits("4.0"));
    await expectBalance(ousd, matt, ousdUnits("106.0"));
  });

  it("Should correctly handle a deposit of DAI (18 digits)", async function () {
    const { ousd, vault, dai, anna, oracle } = await loadFixture(
      defaultFixture
    );
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 3 DAI worth $2 each, she should have $6 OUSD.
    await oracle.setPrice("DAI", oracleUnits("2.00"));
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).depositAndMint(dai.address, daiUnits("3.0"));
    await expectBalance(ousd, anna, ousdUnits("6.0"));
  });

  it("Should correctly handle a deposit of USDC (6 digits)", async function () {
    const { ousd, vault, usdc, anna, oracle } = await loadFixture(
      defaultFixture
    );
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDC", oracleUnits("3.00"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).depositAndMint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("150.0"));
  });

  it("Should allow withdrawals", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expectBalance(usdc, anna, usdcUnits("1000.0"), "Initial balance");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).depositAndMint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("50.0"));
    await vault.connect(anna).withdrawAndBurn(usdc.address, ousdUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("0.0"), "Should remove OUSD");
    await expectBalance(usdc, anna, ousdUnits("1000.0"), "Should return USDC");
  });
});
