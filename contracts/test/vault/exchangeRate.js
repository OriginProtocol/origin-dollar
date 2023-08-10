const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const {
  ousdUnits,
  daiUnits,
  setOracleTokenPriceUsd,
  isFork,
} = require("../helpers");

describe("Vault Redeem", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;
  beforeEach(async function () {
    fixture = await loadDefaultFixture();
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

  it("Should mint less at low oracle, positive exchange rate", async () => {
    const { ousd, vault, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "1.199");
    await reth.connect(anna).mint(daiUnits("4.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("4.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("4.0"), 0);
    await expect(anna).has.a.approxBalanceOf("4.796", ousd);
  });

  it("Should revert mint at too low oracle, positive exchange rate", async () => {
    const { vault, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "1.00");
    await reth.connect(anna).mint(daiUnits("4.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("4.0"));
    const tx = vault.connect(anna).mint(reth.address, daiUnits("4.0"), 0);
    await expect(tx).to.be.revertedWith("Asset price below peg");
  });

  it("Should mint same at high oracle, positive exchange rate", async () => {
    const { ousd, vault, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "1.2");
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

  it("Should redeem less at a high oracle", async () => {
    const { ousd, vault, dai, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    await reth.connect(anna).mint(daiUnits("100.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("100.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("200", ousd, "post mint");
    await vault.rebase();
    await expect(anna).has.a.balanceOf("200", ousd, "post rebase");

    // Contains 100 rETH, (200 units) and 200 DAI (200 units)
    // After Oracles $600 + $200 = $800
    //
    // Redeeming $200 == 1/4 vault
    // 25rETH and 50 DAI

    await setOracleTokenPriceUsd("RETHETH", "6.0");
    await reth.setExchangeRate(daiUnits("6.0"));
    await vault.connect(anna).redeem(daiUnits("200.0"), 0);
    await expect(anna).has.a.balanceOf("25", reth, "RETH");
    await expect(anna).has.a.balanceOf("1050", dai, "USDC");
  });

  it("Should redeem same at a low oracle", async () => {
    const { ousd, vault, dai, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    await reth.connect(anna).mint(daiUnits("100.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("100.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("200", ousd, "post mint");
    await vault.rebase();
    await expect(anna).has.a.balanceOf("200", ousd, "post rebase");

    // Contains 100 rETH, (200 units) and 200 DAI (200 units)
    // After Oracles $154 + $200 = $354
    //
    // But since the exchange rate is still 2.0 the RETH unit price
    // is snapped back to 2.0 when redeeming. Making the calculation:
    // After Oracles $200 + $200 = $400
    //
    // And redeeming 200 is 50% of the vault = 50 RETH & 100 DAI

    await setOracleTokenPriceUsd("RETHETH", "1.54");
    await vault.connect(anna).redeem(daiUnits("200.0"), 0);
    await expect(anna).has.a.balanceOf("50", reth, "RETH");
    await expect(anna).has.a.balanceOf("1100", dai, "USDC");
  });

  it("Should redeem same at a low oracle v2", async () => {
    const { ousd, vault, dai, reth, anna } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    await reth.connect(anna).mint(daiUnits("100.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("100.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("200", ousd, "post mint");
    await vault.rebase();
    await expect(anna).has.a.balanceOf("200", ousd, "post rebase");

    // Contains 100 rETH, (200 units) and 200 DAI (200 units)
    // After Oracles $100 + $200 = $300
    //
    // Redeeming $150 == 1/2 vault
    // 50rETH and 100 DAI

    await setOracleTokenPriceUsd("RETHETH", "1.0");
    await reth.setExchangeRate(daiUnits("1.0"));

    await vault.connect(anna).redeem(daiUnits("150.0"), 0);
    await expect(anna).has.a.approxBalanceOf("50", reth, "RETH");
    await expect(anna).has.a.approxBalanceOf("1100", dai, "USDC");
  });

  it("Should handle an exchange rate reedem attack", async () => {
    const { ousd, vault, reth, anna, matt, governor } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    // Old holder with RETH
    await reth.connect(matt).mint(daiUnits("500.0"));
    await reth.connect(matt).approve(vault.address, daiUnits("500.0"));
    await vault.connect(matt).mint(reth.address, daiUnits("500.0"), 0);

    // Attacker Mints before exchange change
    await reth.connect(anna).mint(daiUnits("500.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("500.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("500.0"), 0);
    await expect(anna).has.a.balanceOf("1000", ousd, "post mint");

    await setOracleTokenPriceUsd("RETHETH", "1.0");
    await reth.setExchangeRate(daiUnits("1.0"));

    // console.log("----");
    // console.log((await vault.totalValue()).toString() / 1e18);
    // console.log((await ousd.totalSupply()).toString() / 1e18);

    // Attacker redeems after exchange change
    await vault.connect(governor).setMaxSupplyDiff(daiUnits("0.9"));
    await expect(
      vault.connect(anna).redeem(daiUnits("1000.0"), 0)
    ).to.be.revertedWith("Backing supply liquidity error");

    // console.log((await vault.totalValue()).toString() / 1e18);
    // console.log((await ousd.totalSupply()).toString() / 1e18);
  });

  it("Should handle an exchange rate reedem attack, delayed oracle", async () => {
    const { ousd, vault, reth, anna, matt, governor } = fixture;

    await setOracleTokenPriceUsd("RETHETH", "2.0");
    await reth.setExchangeRate(daiUnits("2.0"));

    // Old holder with RETH
    await reth.connect(matt).mint(daiUnits("500.0"));
    await reth.connect(matt).approve(vault.address, daiUnits("500.0"));
    await vault.connect(matt).mint(reth.address, daiUnits("500.0"), 0);

    // Attacker Mints before exchange change
    await reth.connect(anna).mint(daiUnits("500.0"));
    await reth.connect(anna).approve(vault.address, daiUnits("500.0"));
    await vault.connect(anna).mint(reth.address, daiUnits("500.0"), 0);
    await expect(anna).has.a.balanceOf("1000", ousd, "post mint");

    await setOracleTokenPriceUsd("RETHETH", "1.3");
    await reth.setExchangeRate(daiUnits("1.0"));

    // console.log("----");
    // console.log((await vault.totalValue()).toString() / 1e18);
    // console.log((await ousd.totalSupply()).toString() / 1e18);

    // Attacker redeems after exchange change
    await vault.connect(governor).setMaxSupplyDiff(daiUnits("0.9"));
    await expect(
      vault.connect(anna).redeem(daiUnits("1000.0"), 0)
    ).to.be.revertedWith("Backing supply liquidity error");

    // console.log((await vault.totalValue()).toString() / 1e18);
    // console.log((await ousd.totalSupply()).toString() / 1e18);
  });
});
