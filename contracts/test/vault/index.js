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

  it("Should support an asset", async () => {
    const { vault, ousd, governor } = await loadFixture(defaultFixture);
    await expect(vault.connect(governor).supportAsset(ousd.address)).to.emit(
      vault,
      "AssetSupported"
    );
  });

  it("Should revert when adding an asset that is already supported", async function () {
    const { vault, usdt, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).supportAsset(usdt.address)
    ).to.be.revertedWith("Asset already supported");
  });

  it("Should revert when attempting to support an asset and not governor", async function () {
    const { vault, usdt } = await loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should revert when adding a strategy that is already added", async function () {
    const { vault, governor, compoundStrategy } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).addStrategy(compoundStrategy.address, 100);
    await expect(
      vault.connect(governor).addStrategy(compoundStrategy.address, 100)
    ).to.be.revertedWith("Strategy already added");
  });

  it("Should revert when attempting to add a strategy and not Governor", async function () {
    const { vault, josh, compoundStrategy } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(josh).addStrategy(compoundStrategy.address, 100)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdc, dai, matt } = await loadFixture(defaultFixture);

    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"));
    await expect(matt).has.a.balanceOf("102.00", ousd);

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).mint(dai.address, daiUnits("4.0"));
    await expect(matt).has.a.balanceOf("106.00", ousd);
  });

  it("Should correctly handle a deposit of DAI (18 decimals)", async function () {
    const { ousd, vault, dai, anna, oracle } = await loadFixture(
      defaultFixture
    );
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // If Anna deposits 3 DAI worth $2 each, she should have $6 OUSD.
    await oracle.setPrice("DAI", oracleUnits("2.00"));
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).mint(dai.address, daiUnits("3.0"));
    await expect(anna).has.a.balanceOf("6.00", ousd);
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, vault, usdc, anna, oracle } = await loadFixture(
      defaultFixture
    );
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDC", oracleUnits("3.00"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("150.00", ousd);
  });

  it("Should correctly handle a deposit failure of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, oracle, nonStandardToken } = await loadFixture(
      defaultFixture
    );
    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await oracle.setPrice("NonStandardToken", oracleUnits("2.00"));
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("1500.0"));

    // Anna has a balance of 1000 tokens and she is trying to
    // transfer 1500 tokens. The contract doesn't throw but
    // fails silently, so Anna's OUSD balance should be zero.
    try {
      await vault
        .connect(anna)
        .mint(nonStandardToken.address, usdtUnits("1500.0"));
    } catch (err) {
      expect(
        /revert SafeERC20: ERC20 operation did not succeed/gi.test(err.message)
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expect(anna).has.a.balanceOf("0.00", ousd);
      await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    }
  });

  it("Should correctly handle a deposit of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, oracle, nonStandardToken } = await loadFixture(
      defaultFixture
    );
    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await oracle.setPrice("NonStandardToken", oracleUnits("2.00"));
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, usdtUnits("100.0"));
    await expect(anna).has.a.balanceOf("200.00", ousd);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
  });

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
    // intentionaly skipping the rebase after the price change,
    // to watch it happen automaticly.
    await oracle.setPrice("DAI", oracleUnits("2.00"));
    await vault.connect(matt).redeem(dai.address, ousdUnits("2.0"));
    // with DAI now worth $2, we should only get one DAI for our two OUSD.
    await expect(matt).has.a.balanceOf("901.00", dai);
    // OUSD's backing assets are worth more
    await expect(matt).has.a.balanceOf("398.00", ousd, "ending balance");

    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
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

  it("Should revert redeem if allowance is insufficient", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);

    // Mint some OUSD tokens
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);

    // Try to withdraw without allowance
    await expect(
      vault.connect(anna).redeem(usdc.address, ousdUnits("50.0"))
    ).to.be.revertedWith("Allowance is not sufficient");
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

  it("Should calculate the balance correctly with DAI", async () => {
    const { vault } = await loadFixture(defaultFixture);
    // Vault already has DAI from default ficture
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
  });

  it("Should calculate the balance correctly with USDC", async () => {
    const { vault, usdc, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"));
    // Fixture loads 200 DAI, so result should be 202
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("202", 18)
    );
  });

  it("Should calculate the balance correctly with USDT", async () => {
    const { vault, usdt, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("5.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("5.0"));
    // Fixture loads 200 DAI, so result should be 205
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("205", 18)
    );
  });

  it("Should calculate the balance correctly with TUSD", async () => {
    const { vault, tusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"));
    // Fixture loads 200 DAI, so result should be 209
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("209", 18)
    );
  });

  it("Should calculate the balance correctly with DAI, USDC, USDT, TUSD", async () => {
    const { vault, usdc, usdt, tusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("20.0"));
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"));
    // Fixture loads 200 DAI, so result should be 237
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("237", 18)
    );
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to add Strategy", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).addStrategy(ousd.address, 100);
  });

  it("Should revert when removing a Strategy that has not been added", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(ousd.address)
    ).to.be.revertedWith("Strategy not added");
  });

  it(
    "Should return a zero address for deposit when no strategy supports asset"
  );

  it(
    "Should prioritise withdrawing from Vault if sufficient amount of asset available"
  );

  it("Should mint for multiple tokens in a single call", async () => {
    const { vault, matt, ousd, dai, usdt } = await loadFixture(defaultFixture);

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await dai.connect(matt).approve(vault.address, daiUnits("25.0"));

    await vault
      .connect(matt)
      .mintMultiple(
        [usdt.address, dai.address],
        [usdtUnits("50"), daiUnits("25")]
      );

    await expect(matt).has.a.balanceOf("175.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("275.0"));
  });

  it("Should revert mint for multiple tokens if any transfer fails", async () => {
    const { vault, matt, ousd, dai, usdt } = await loadFixture(defaultFixture);

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await dai.connect(matt).approve(vault.address, daiUnits("25.0"));

    await expect(
      vault
        .connect(matt)
        .mintMultiple(
          [usdt.address, dai.address],
          [usdtUnits("50"), daiUnits("250")]
        )
    ).to.be.reverted;

    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });
});
