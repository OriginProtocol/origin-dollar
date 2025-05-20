const { expect } = require("chai");

const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, isCI } = require("../helpers");
const loadFixture = createFixtureLoader(buybackFixture);

describe("Buyback", function () {
  let fixture;

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should allow Governor to set Trustee address on Vault", async () => {
    const { vault, governor, ousd } = fixture;
    // Pretend OUSD is Treasury Manager
    await vault.connect(governor).setTrusteeAddress(ousd.address);

    expect(await vault.trusteeAddress()).to.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address on Vault", async () => {
    const { vault, anna, ousd } = fixture;
    // Pretend OUSD is Treasury Manager
    await expect(
      vault.connect(anna).setTrusteeAddress(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Strategist address", async () => {
    const { ousdBuyback, governor, ousd } = fixture;
    // Pretend OUSD is a Strategist
    await ousdBuyback.connect(governor).setStrategistAddr(ousd.address);
    expect(await ousdBuyback.strategistAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Strategist address", async () => {
    const { ousdBuyback, anna, ousd } = fixture;
    // Pretend OUSD is Strategist
    await expect(
      ousdBuyback.connect(anna).setStrategistAddr(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow withdrawal of arbitrary token by Governor/Strategist", async () => {
    const { vault, ousd, usdc, matt, governor, strategist, ousdBuyback } =
      fixture;
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(ousdBuyback.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await ousdBuyback
      .connect(governor)
      .transferToken(ousd.address, ousdUnits("6.0"));
    await expect(strategist).has.a.balanceOf("6.0", ousd);
    // Matt asks Strategist for help
    await ousdBuyback
      .connect(strategist)
      .transferToken(ousd.address, ousdUnits("2.0"));
    await expect(strategist).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow withdrawal of arbitrary token by non-Governor/Strategist", async () => {
    const { ousdBuyback, ousd, matt } = fixture;
    // Naughty Matt
    await expect(
      ousdBuyback.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
