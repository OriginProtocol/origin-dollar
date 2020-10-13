const { defaultFixture } = require("../_fixture");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { utils } = require("ethers");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

describe("Vault", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should support an asset", async () => {
    const { vault, ousd, governor } = await loadFixture(defaultFixture);
    const origAssetCount = await vault.connect(governor).getAssetCount();
    expect(await vault.isSupportedAsset(ousd.address)).to.be.false;
    await expect(vault.connect(governor).supportAsset(ousd.address)).to.emit(
      vault,
      "AssetSupported"
    );
    expect(await vault.getAssetCount()).to.equal(origAssetCount.add(1));
    const assets = await vault.connect(governor).getAllAssets();
    expect(assets.length).to.equal(origAssetCount.add(1));
    expect(await vault["checkBalance(address)"](ousd.address)).to.equal(0);
    expect(await vault.isSupportedAsset(ousd.address)).to.be.true;
  });

  it("Should revert when adding an asset that is already supported", async function () {
    const { vault, usdt, governor } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;
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
    await vault
      .connect(governor)
      .addStrategy(compoundStrategy.address, utils.parseUnits("1", 18));
    await expect(
      vault
        .connect(governor)
        .addStrategy(compoundStrategy.address, utils.parseUnits("1", 18))
    ).to.be.revertedWith("Strategy already added");
  });

  it("Should revert when attempting to add a strategy and not Governor", async function () {
    const { vault, josh, compoundStrategy } = await loadFixture(defaultFixture);

    await expect(
      vault
        .connect(josh)
        .addStrategy(compoundStrategy.address, utils.parseUnits("1", 18))
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
    const { ousd, vault, dai, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // We limit to paying to $1 OUSD for for one stable coin,
    // so this will deposit at a rate of $1.
    await setOracleTokenPriceUsd("DAI", "1.50");
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).mint(dai.address, daiUnits("3.0"));
    await expect(anna).has.a.balanceOf("3.00", ousd);
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await setOracleTokenPriceUsd("USDC", "0.80");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("40.00", ousd);
  });

  it("Should correctly handle a deposit failure of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.30");
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
    const { ousd, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, usdtUnits("100.0"));
    await expect(anna).has.a.balanceOf("100.00", ousd);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
  });

  it("Should calculate the balance correctly with DAI", async () => {
    const { viewVault } = await loadFixture(defaultFixture);
    // Vault already has DAI from default ficture
    await expect(await viewVault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
  });

  it("Should calculate the balance correctly with USDC", async () => {
    const { vault, viewVault, usdc, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"));
    // Fixture loads 200 DAI, so result should be 202
    await expect(await viewVault.totalValue()).to.equal(
      utils.parseUnits("202", 18)
    );
  });

  it("Should calculate the balance correctly with USDT", async () => {
    const { vault, viewVault, usdt, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("5.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("5.0"));
    // Fixture loads 200 DAI, so result should be 205
    await expect(await viewVault.totalValue()).to.equal(
      utils.parseUnits("205", 18)
    );
  });

  it("Should calculate the balance correctly with TUSD", async () => {
    const { vault, viewVault, tusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"));
    // Fixture loads 200 DAI, so result should be 209
    await expect(await viewVault.totalValue()).to.equal(
      utils.parseUnits("209", 18)
    );
  });

  it("Should calculate the balance correctly with DAI, USDC, USDT, TUSD", async () => {
    const { vault, viewVault, usdc, usdt, tusd, matt } = await loadFixture(
      defaultFixture
    );

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
    await expect(await viewVault.totalValue()).to.equal(
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
    await vault
      .connect(governor)
      .addStrategy(ousd.address, utils.parseUnits("1", 18));
  });

  it("Should revert when removing a Strategy that has not been added", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(ousd.address)
    ).to.be.revertedWith("Strategy not added");
  });

  it("Should correctly handle a mint with auto rebase", async function () {
    const { ousd, vault, usdc, matt, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await usdc.connect(anna).mint(usdcUnits("5000.0"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("5000.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("5000.0"));
    await expect(anna).has.a.balanceOf("5000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

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

  it("Should mint for multiple tokens in a single call with auto rebase", async () => {
    const { vault, matt, anna, ousd, dai, usdt } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    await usdt.connect(anna).mint(usdtUnits("2500.00"));
    await usdt.connect(anna).approve(vault.address, usdtUnits("2500.00"));
    await dai.connect(anna).mint(daiUnits("2500.00"));
    await dai.connect(anna).approve(vault.address, daiUnits("2500.00"));

    await vault
      .connect(anna)
      .mintMultiple(
        [usdt.address, dai.address],
        [usdtUnits("2500.00"), daiUnits("2500.00")]
      );

    await expect(anna).has.a.balanceOf("5000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("5200.0"));
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

  it("Should handle mintMultiple with duplicate tokens correctly", async () => {
    const { ousd, vault, josh, dai } = await loadFixture(defaultFixture);
    // 900 DAI because 100 was used to mint OUSD in the fixture
    await expect(josh).has.a.balanceOf("900", dai);
    await dai.connect(josh).approve(vault.address, daiUnits("247"));
    await vault
      .connect(josh)
      .mintMultiple(
        [dai.address, dai.address, dai.address],
        [daiUnits("105"), daiUnits("50"), daiUnits("92")]
      );
    // Josh had 100 OUSD from the fixture
    await expect(josh).has.a.balanceOf("347", ousd);
    await expect(josh).has.a.balanceOf("653", dai);
  });

  it("Should not mint OUSD for unsupported assets in mintMultiple", async () => {
    const { ousd, vault, josh, nonStandardToken, dai } = await loadFixture(
      defaultFixture
    );
    // 900 DAI because 100 was used to mint OUSD in the fixture
    await expect(josh).has.a.balanceOf("900", dai);
    await expect(josh).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(josh)
      .approve(vault.address, usdtUnits("100.0"));
    await dai.connect(josh).approve(vault.address, daiUnits("50"));
    await vault
      .connect(josh)
      .mintMultiple(
        [nonStandardToken.address, dai.address],
        [usdtUnits("100.0"), daiUnits("50")]
      );
    // Josh had 100 OUSD from the fixture
    await expect(josh).has.a.balanceOf("150", ousd);
    await expect(josh).has.a.balanceOf("850", dai);
    // Josh doesn't get OUSD for her non standard token
    // TODO the Vault should not take the token off Josh if it is not supported
    // OR the transaction should revert
    await expect(josh).has.a.balanceOf("900.00", nonStandardToken);
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

  it("Should allow governor to change rebase threshold", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).setRebaseThreshold(ousdUnits("400"));
  });

  it("Should not allow non-governor to change rebase threshold", async () => {
    const { vault } = await loadFixture(defaultFixture);
    expect(vault.setRebaseThreshold(ousdUnits("400"))).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });
});
