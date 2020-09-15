const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  isGanacheFork,
} = require("../helpers");

describe("Vault Redeem", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should allow a redeem", async () => {
    const { ousd, vault, usdc, anna, dai } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await expect(anna).has.a.balanceOf("1000.00", dai);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await ousd.connect(anna).approve(vault.address, ousdUnits("50.0"));
    await vault.connect(anna).redeem(ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // Redeem outputs will be 50/250 * 50 USDC and 200/250 * 50 DAI from fixture
    await expect(anna).has.a.balanceOf("960.00", usdc);
    await expect(anna).has.a.balanceOf("1040.00", dai);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should allow a redeem at different asset prices", async () => {
    const { ousd, vault, dai, matt } = await loadFixture(defaultFixture);
    await expect(matt).has.a.balanceOf(
      "100.00",
      ousd,
      "Matt has incorrect starting balance"
    );
    await expect(matt).has.a.balanceOf("900.00", dai);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
    // Intentionally skipping the rebase after the price change,
    // to watch it happen automatically
    await setOracleTokenPriceUsd("DAI", "1.50");

    // 200 DAI in Vault, change in price means vault value is $300
    await vault.connect(matt).redeem(ousdUnits("2.0"));
    // with DAI now worth $1.5, we should only get 1.33 DAI for our two OUSD.
    await expect(matt).has.a.approxBalanceOf("901.33", dai);
    // OUSD's backing assets are worth more
    await expect(matt).has.a.approxBalanceOf("148.00", ousd, "ending balance");

    expect(await ousd.totalSupply()).to.eq(ousdUnits("297.999999999999999999"));
  });

  it("Should allow redeems of non-standard tokens", async () => {
    const { ousd, vault, anna, governor, nonStandardToken } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

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
    await vault.connect(anna).redeem(ousdUnits("100.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // 66.66 would have come back as DAI because there is 100 NST and 200 DAI
    await expect(anna).has.an.approxBalanceOf("933.33", nonStandardToken);
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
    await vault.connect(anna).redeem(ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // 45 after redeem fee
    // USDC is 50/250 of total assets, so balance should be 950 + 50/250 * 45 = 959
    await expect(anna).has.a.balanceOf("959.00", usdc);
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
      vault.connect(anna).redeem(ousdUnits("100.0"))
    ).to.be.revertedWith("Burn exceeds balance");
  });

  it("Should only allow Governor to set a redeem fee", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should redeem entire OUSD balance", async () => {
    const { ousd, vault, usdc, dai, anna } = await loadFixture(defaultFixture);

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
    await vault.connect(anna).redeemAll();

    // 100 USDC and 350 DAI in contract
    // (1000-100) + 100/450 * 250 USDC
    // (1000-150) + 350/450 * 250 DAI
    await expect(anna).has.an.approxBalanceOf("955.55", usdc);
    await expect(anna).has.an.approxBalanceOf("1044.44", dai);
  });

  it("Should redeem entire OUSD balance, with a higher oracle price", async () => {
    const { ousd, vault, usdc, dai, anna, governor } = await loadFixture(
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

    await setOracleTokenPriceUsd("USDC", "1.30");
    await setOracleTokenPriceUsd("DAI", "1.20");
    await vault.connect(governor).rebase();

    // Anna's share of OUSD is 200/450
    // Vault has 100 USDC and 350 DAI total
    // 200/450 * 100 * 1.3 + 350 * 1.2
    await expect(anna).has.an.approxBalanceOf("305.55", ousd);

    // Withdraw all
    await ousd.connect(anna).approve(vault.address, ousdUnits("250.0"));
    await vault.connect(anna).redeemAll();

    // 100 USDC and 350 DAI in contract
    // 100 * 1.30 = 130 USD value for USDC
    // 350 * 1.20 = 420 USD value for DAI
    // 100/450 * 305.5555555 = 67.9012345556 USDC
    // 350/450 * 305.5555555 = 237.654320944 DAI
    // Difference between output value and redeem value is:
    // 305.5555555 - (67.9012345556 * 1.3 + 237.654320944 * 1.20) = -67.9012345551
    // Remove 67.9012345551/2.5/2  from USDC
    // Remove 67.9012345551/2.5/2  from DAI
    // (1000-100) + 100/450 * 305.5555555 - 67.9012345551/2.5/2 USDC
    // (1000-150) + 350/450 * 305.5555555 - 67.9012345551/2.5/2 DAI
    await expect(anna).has.an.approxBalanceOf("954.32", usdc); // To be mathed out
    await expect(anna).has.an.approxBalanceOf("1074.07", dai); // To be mathed out
  });

  it("Should redeem entire OUSD balance, with a lower oracle price");
});
