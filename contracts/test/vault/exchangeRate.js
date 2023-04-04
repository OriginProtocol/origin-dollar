const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  daiUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  isFork,
} = require("../helpers");

describe.only("Vault Redeem", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;

  beforeEach(async function () {
    fixture = await loadFixture(defaultFixture);
    const { vault, reth, governor } = fixture;
    await vault.connect(governor).supportAsset(reth.address, 1);
    await setOracleTokenPriceUsd("RETHETH", "1.2");
  });

  it("Should mint at a positive exchange rate", async () => {
    const { ousd, vault, reth, anna } = fixture;

    await reth.connect(anna).mint(daiUnits("4.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("4.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("4.0"), 0);
    await expect(anna).has.a.balanceOf("4.80", ousd);
  });

  it("Should rebase at a positive exchange rate", async () => {
    const { ousd, vault, reth, anna } = fixture;

    const beforeGift = await ousd.totalSupply();

    await reth.connect(anna).mint(daiUnits("1000.0"));
    await reth.connect(anna).transfer(vault.address, daiUnits("1000.0"));

    await vault.rebase();
    const afterGift = await ousd.totalSupply();
    expect(afterGift.sub(beforeGift)).to.approxEqualTolerance(
      ousdUnits("1200"),
      1,
      "afterGift"
    );

    await setOracleTokenPriceUsd("RETHETH", "1.4");
    await reth.setExchangeRate(daiUnits("1.4"));
    await vault.rebase();
    const afterExchangeUp = await ousd.totalSupply();

    expect(afterExchangeUp.sub(afterGift)).to.approxEqualTolerance(
      ousdUnits("200"),
      1,
      "afterExchangeUp"
    );
  });

  it("Should redeem at the expected rate", async () => {
    const { ousd, vault, dai, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    await reth.connect(anna).mint(daiUnits("100.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("100.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("200", ousd, "post mint");
    await vault.rebase();
    await expect(anna).has.a.balanceOf("200", ousd, "post rebase");

    await vault.connect(anna).redeem(daiUnits("200.0"), 0);
    await expect(anna).has.a.balanceOf("50", reth, "RETH");
    await expect(anna).has.a.balanceOf("1100", dai, "USDC");
  });
});
