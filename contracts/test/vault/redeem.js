const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  setOracleTokenPriceUsdMinMax,
  isGanacheFork,
  expectApproxSupply,
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
    const { ousd, mixOracle, vault, dai, matt, viewVault } = await loadFixture(
      defaultFixture
    );
    await expect(matt).has.a.balanceOf(
      "100.00",
      ousd,
      "Matt has incorrect starting balance"
    );
    await expect(matt).has.a.balanceOf("900.00", dai);
    await expectApproxSupply(ousd, ousdUnits("200"));
    // Intentionally skipping the rebase after the price change,
    // to watch it happen automatically
    await setOracleTokenPriceUsd("DAI", "1.25");

    // 200 DAI in Vault, change in price means vault value is $250
    await vault.connect(matt).redeem(ousdUnits("2.0"));
    await expectApproxSupply(ousd, ousdUnits("248"));
    // with the total supply now 225, we should get
    // with DAI now worth $1.25, we should only get 1.5 DAI for our two OUSD.
    await expect(matt).has.a.approxBalanceOf("901.60", dai);
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
    await expect(await vault.redeemFeeBps()).to.equal("0");
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

    // Anna's share of OUSD is 250/450
    // Vault has 100 USDC and 350 DAI total
    // 250/450 * (100 * 1.3 + 350 * 1.2)
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
    // Total from price is (67.9012345556 * 1.3 + 237.654320944 * 1.20) = 373.45679005508
    // Remove 67.9012345551 * 67.9012345556 / 373.45679005508 from USDC
    // Remove 67.9012345551 * 237.654320944 / 373.45679005508  from DAI
    // (1000-100) + 100/450 * 305.5555555 - 67.9012345551 * 67.9012345556 / 373.45679005508 USDC
    // (1000-150) + 350/450 * 305.5555555 - 67.9012345551 * 237.654320944 / 373.45679005508 DAI
    await expect(anna).has.an.approxBalanceOf(
      "955.55",
      usdc,
      "USDC has wrong balance"
    );
    await expect(anna).has.an.approxBalanceOf(
      "1044.44",
      dai,
      "DAI has wrong balance"
    );
  });

  it("Should redeem entire OUSD balance, with a lower oracle price", async () => {
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

    await setOracleTokenPriceUsd("USDC", "0.90");
    await setOracleTokenPriceUsd("DAI", "0.80");
    await vault.connect(governor).rebase();

    // Anna's share of OUSD is 250/450
    // Vault has 100 USDC and 350 DAI total
    // 250/450 * (100 * 0.90 + 350 * 0.80)
    await expect(anna).has.an.approxBalanceOf("205.55", ousd);

    // Withdraw all
    await ousd.connect(anna).approve(vault.address, ousdUnits("500"));
    await vault.connect(anna).redeemAll();

    // 100 USDC and 350 DAI in contract
    // 100 * 0.90 = 90 USD value for USDC
    // 350 * 0.80 = 280 USD value for DAI
    // 100/450 * 205.5555555 = 45.6790123333 USDC
    // 350/450 * 205.5555555 = 159.876543167 DAI
    // Difference between output value and redeem value is:
    // 205.5555555 - (45.6790123333 * 0.9 + 159.876543167 * 0.8) = 36.5432098664
    // Total from price is 45.6790123333 * 0.9 + 159.876543167 * 0.8 = 169.01234563357002
    // Add 36.5432098664 * 45.6790123333 / 169.01234563357002 to USDC
    // Add 36.5432098664 * 159.876543167 / 169.01234563357002 to DAI
    // (1000-100) + 100/450 * 205.5555555 + 36.5432098664 * 45.6790123333 / 169.01234563357002 USDC
    // (1000-150) + 350/450 * 205.5555555 + 36.5432098664 * 159.876543167 / 169.01234563357002 DAI
    await expect(anna).has.an.approxBalanceOf(
      "955.55",
      usdc,
      "USDC has wrong balance"
    );
    await expect(anna).has.an.approxBalanceOf(
      "1044.44",
      dai,
      "DAI has wrong balance"
    );
  });

  it("Should have correct balances on consecutive mint and redeem", async () => {
    const { ousd, vault, usdc, dai, anna, matt, josh } = await loadFixture(
      defaultFixture
    );

    const usersWithBalances = [
      [anna, 0],
      [matt, 100],
      [josh, 100],
    ];

    const assetsWithUnits = [
      [dai, daiUnits],
      [usdc, usdcUnits],
    ];

    for (const [user, startBalance] of usersWithBalances) {
      for (const [asset, units] of assetsWithUnits) {
        for (const amount of [5.09, 10.32, 20.99, 100.01]) {
          asset.connect(user).approve(vault.address, units(amount.toString()));
          vault.connect(user).mint(asset.address, units(amount.toString()));
          await expect(user).has.an.approxBalanceOf(
            (startBalance + amount).toString(),
            ousd
          );
          await vault.connect(user).redeem(ousdUnits(amount.toString()));
          await expect(user).has.an.approxBalanceOf(
            startBalance.toString(),
            ousd
          );
        }
      }
    }
  });

  it("Should have correct balances on consecutive mint and redeem with varying oracle prices", async () => {
    const { ousd, vault, dai, matt, josh } = await loadFixture(defaultFixture);

    const usersWithBalances = [
      // [anna, 0],
      [matt, 100],
      [josh, 100],
    ];

    const assetsWithUnits = [
      [dai, daiUnits],
      // [usdc, usdcUnits],
    ];

    for (const [user, startBalance] of usersWithBalances) {
      for (const [asset, units] of assetsWithUnits) {
        for (const price of [0.98, 1.02, 1.09]) {
          await setOracleTokenPriceUsd(await asset.symbol(), price.toString());
          for (const amount of [5.09, 10.32, 20.99, 100.01]) {
            asset
              .connect(user)
              .approve(vault.address, units(amount.toString()));
            vault.connect(user).mint(asset.address, units(amount.toString()));
            await expect(user).has.an.approxBalanceOf(
              (startBalance * price + amount * price).toString(),
              ousd
            );
            await vault
              .connect(user)
              .redeem(ousdUnits((amount * price).toString()));
            await expect(user).has.an.approxBalanceOf(
              (startBalance * price).toString(),
              ousd
            );
          }
        }
      }
    }
  });

  it("Should have correct balances on consecutive mint and redeem with min/max oracle spread", async () => {
    const { ousd, vault, usdc, dai, anna, governor } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("1000", usdc);
    await expect(anna).has.a.balanceOf("1000", dai);

    // Mint 1000 OUSD tokens using USDC
    await usdc.connect(anna).approve(vault.address, usdcUnits("1000"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("1000"));
    await expect(anna).has.a.balanceOf("1000", ousd);

    await setOracleTokenPriceUsdMinMax("USDC", "1.010", "1.005");
    await setOracleTokenPriceUsdMinMax("DAI", "1", "1");
    await vault.connect(governor).rebase();

    // Vault has 1000 USDC and 200 DAI
    // 1000/1200 * (1000 * 1.005 + 200 * 1)
    await expect(anna).has.an.approxBalanceOf("1004.16", ousd);

    await vault.connect(anna).redeemAll();

    // Proportional redeem is:
    // 1000/1200 * 1004.16 = 836.8 USDC and 200/1200 * 1004.16 = 167.36 DAI
    // Value is 836.8 * 1.010 + 167.36 * 1 = 1012.528
    // Attempt to reduce by removing 1012.528 - 1004.16 = 8.368:
    // Remove 1000/1200 * 8.368 USDC and 200/1200 * 8.368 DAI
    // 836.8 - 1000/1200 * 8.368 = 829.826
    // 167.36 - 200/1200 * 8.368 = 165.965
    // Check it works out: 829.826 * 1.010 + 165.965
    await expect(anna).has.an.approxBalanceOf("829.826", usdc);
    // Already had 1000 DAI
    await expect(anna).has.an.approxBalanceOf("1165.96", dai);
  });
});
