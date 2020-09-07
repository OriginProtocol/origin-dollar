const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  oracleUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("Vault", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should allow a redeem", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await ousd.connect(anna).approve(vault.address, ousdUnits("50.0"));
    await vault.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should allow a redeem at different asset prices", async () => {
    const { ousd, vault, oracle, dai, matt } = await loadFixture(
      defaultFixture
    );
    await expect(matt).has.a.balanceOf("100.00", ousd, "starting balance");
    await expect(matt).has.a.balanceOf("900.00", dai);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
    // Intentionaly skipping the rebase after the price change,
    // to watch it happen automatically
    await oracle.setPrice("DAI", oracleUnits("2.00"));
    await vault.connect(matt).redeem(dai.address, ousdUnits("2.0"));
    // with DAI now worth $2, we should only get one DAI for our two OUSD.
    await expect(matt).has.a.balanceOf("901.00", dai);
    // OUSD's backing assets are worth more
    await expect(matt).has.a.balanceOf("198.00", ousd, "ending balance");

    expect(await ousd.totalSupply()).to.eq(ousdUnits("398.0"));
  });

  it("Should allow redeems of non-standard tokens", async () => {
    const { ousd, vault, anna, nonStandardToken, oracle } = await loadFixture(
      defaultFixture
    );
    await oracle.setPrice("NonStandardToken", oracleUnits("1.00"));
    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);

    // Mint 100 OUSD for 100 tokens
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, usdtUnits("100.0"));
    await expect(anna).has.a.balanceOf("100.00", ousd);

    // Redeem 100 tokens for 100 OUSD
    await ousd.connect(anna).approve(vault.address, ousdUnits("100.0"));
    await vault
      .connect(anna)
      .redeem(nonStandardToken.address, ousdUnits("100.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
  });

  it("Should have a default redeem fee of 0", async () => {
    const { vault } = await loadFixture(defaultFixture);
    await expect(await vault.getRedeemFeeBps()).to.equal("0");
  });

  it("Should charge a redeem fee if redeem fee set", async () => {
    const { ousd, vault, usdc, anna, governor } = await loadFixture(
      defaultFixture
    );
    // 1000 basis points = 10%
    await vault.connect(governor).setRedeemFeeBps(1000);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await ousd.connect(anna).approve(vault.address, ousdUnits("50.0"));
    await vault.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("995.00", usdc);
  });

  it("Should revert redeem if balance is insufficient", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);

    // Mint some OUSD tokens
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);

    // Try to withdraw more than balance
    await ousd.connect(anna).approve(vault.address, ousdUnits("100.0"));
    await expect(
      vault.connect(anna).redeem(usdc.address, ousdUnits("100.0"))
    ).to.be.revertedWith("Liquidity error");
  });

  it("Should only allow Governor to set a redeem fee", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should redeem entire OUSD balance", async () => {
    const { ousd, vault, usdc, usdt, dai, anna } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("1000.00", usdc);

    // Mint 100 OUSD tokens using USDC
    await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("100.0"));
    await expect(anna).has.a.balanceOf("100.00", ousd);

    // Mint 150 OUSD tokens using DAI
    await dai.connect(anna).approve(vault.address, daiUnits("150.0"));
    await vault.connect(anna).mint(dai.address, daiUnits("150.0"));
    await expect(anna).has.a.balanceOf("250.00", ousd);

    // Withdraw all
    await ousd.connect(anna).approve(vault.address, ousdUnits("250.0"));
    await vault.connect(anna).redeemAll(dai.address);

    await expect(anna).has.a.balanceOf("1100.00", dai);
    await expect(anna).has.a.balanceOf("0", ousd);
  });
});
