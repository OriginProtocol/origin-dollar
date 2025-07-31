const { expect } = require("chai");
const hre = require("hardhat");
const { utils } = require("ethers");

const { loadDefaultFixture } = require("../_fixture");
const {
  ousdUnits,
  usdsUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  getOracleAddresses,
  isFork,
} = require("../helpers");

describe("Vault", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should support an asset", async () => {
    const { vault, oracleRouter, ousd, governor } = fixture;

    const oracleAddresses = await getOracleAddresses(hre.deployments);
    const origAssetCount = await vault.connect(governor).getAssetCount();
    expect(await vault.isSupportedAsset(ousd.address)).to.be.false;

    /* Mock oracle feeds report 0 for updatedAt data point. Set
     * maxStaleness to 100 years from epoch to make the Oracle
     * feeds valid
     */
    const maxStaleness = 24 * 60 * 60 * 365 * 100;

    await oracleRouter.setFeed(
      ousd.address,
      oracleAddresses.chainlink.USDS_USD,
      maxStaleness
    );
    await oracleRouter.cacheDecimals(ousd.address);
    await expect(vault.connect(governor).supportAsset(ousd.address, 0)).to.emit(
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
    const { vault, usdt, governor } = fixture;

    expect(await vault.isSupportedAsset(usdt.address)).to.be.true;
    await expect(
      vault.connect(governor).supportAsset(usdt.address, 0)
    ).to.be.revertedWith("Asset already supported");
  });

  it("Should revert when attempting to support an asset and not governor", async function () {
    const { vault, usdt } = fixture;
    await expect(vault.supportAsset(usdt.address, 0)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should revert when adding a strategy that is already approved", async function () {
    const { vault, governor, compoundStrategy } = fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    await expect(
      vault.connect(governor).approveStrategy(compoundStrategy.address)
    ).to.be.revertedWith("Strategy already approved");
  });

  it("Should revert when attempting to approve a strategy and not Governor", async function () {
    const { vault, josh, compoundStrategy } = fixture;

    await expect(
      vault.connect(josh).approveStrategy(compoundStrategy.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdc, usds, matt } = fixture;

    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    await expect(matt).has.a.balanceOf("102.00", ousd);

    // Matt deposits USDS, 18 decimals
    await usds.connect(matt).approve(vault.address, usdsUnits("4.0"));
    await vault.connect(matt).mint(usds.address, usdsUnits("4.0"), 0);
    await expect(matt).has.a.balanceOf("106.00", ousd);
  });

  it("Should correctly handle a deposit of USDS (18 decimals)", async function () {
    const { ousd, vault, usds, anna } = fixture;

    await expect(anna).has.a.balanceOf("0.00", ousd);
    // We limit to paying to $1 OUSD for for one stable coin,
    // so this will deposit at a rate of $1.
    await setOracleTokenPriceUsd("USDS", "1.30");
    await usds.connect(anna).approve(vault.address, usdsUnits("3.0"));
    await vault.connect(anna).mint(usds.address, usdsUnits("3.0"), 0);
    await expect(anna).has.a.balanceOf("3.00", ousd);
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await setOracleTokenPriceUsd("USDC", "0.998");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("49.90", ousd);
  });

  it("Should not allow a below peg deposit", async function () {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await setOracleTokenPriceUsd("USDC", "0.95");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(
      vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0)
    ).to.be.revertedWith("Asset price below peg");
  });

  it("Should correctly handle a deposit failure of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, nonStandardToken, oracleRouter, governor } =
      fixture;

    await oracleRouter.cacheDecimals(nonStandardToken.address);
    await vault.connect(governor).supportAsset(nonStandardToken.address, 0);
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
        .mint(nonStandardToken.address, usdtUnits("1500.0"), 0);
    } catch (err) {
      expect(
        /reverted with reason string 'SafeERC20: ERC20 operation did not succeed/gi.test(
          err.message
        )
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expect(anna).has.a.balanceOf("0.00", ousd);
      await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    }
  });

  it("Should correctly handle a deposit of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, nonStandardToken, oracleRouter, governor } =
      fixture;

    await oracleRouter.cacheDecimals(nonStandardToken.address);
    await vault.connect(governor).supportAsset(nonStandardToken.address, 0);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(anna)
      .approve(vault.address, usdtUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, usdtUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", ousd);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
  });

  it("Should calculate the balance correctly with USDS", async () => {
    const { vault } = fixture;

    // Vault already has USDS from default ficture
    expect(await vault.totalValue()).to.equal(utils.parseUnits("200", 18));
  });

  it("Should calculate the balance correctly with USDC", async () => {
    const { vault, usdc, matt } = fixture;

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    // Fixture loads 200 USDS, so result should be 202
    expect(await vault.totalValue()).to.equal(utils.parseUnits("202", 18));
  });

  it("Should calculate the balance correctly with USDT", async () => {
    const { vault, usdt, matt } = fixture;

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("5.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("5.0"), 0);
    // Fixture loads 200 USDS, so result should be 205
    expect(await vault.totalValue()).to.equal(utils.parseUnits("205", 18));
  });

  it("Should calculate the balance correctly with TUSD", async () => {
    const { vault, tusd, matt } = fixture;

    await tusd.connect(matt).mint(ousdUnits("100.0"));

    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"), 0);
    // Fixture loads 200 USDS, so result should be 209
    expect(await vault.totalValue()).to.equal(utils.parseUnits("209", 18));
  });

  it("Should calculate the balance correctly with USDS, USDC, USDT, TUSD", async () => {
    const { vault, usdc, usdt, tusd, matt } = fixture;

    await tusd.connect(matt).mint(ousdUnits("100.0"));

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("20.0"), 0);
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"), 0);
    // Fixture loads 200 USDS, so result should be 237
    expect(await vault.totalValue()).to.equal(utils.parseUnits("237", 18));
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor } = fixture;

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = fixture;

    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should not allow transfer of supported token by governor", async () => {
    const { vault, usdc, governor } = fixture;

    // Matt puts USDC in vault
    await usdc.transfer(vault.address, usdcUnits("8.0"));
    // Governor cannot move USDC because it is a supported token.
    await expect(
      vault.connect(governor).transferToken(usdc.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Only unsupported assets");
  });

  it("Should allow Governor to add Strategy", async () => {
    const { vault, governor, ousd } = fixture;

    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).approveStrategy(ousd.address);
  });

  it("Should revert when removing a Strategy that has not been added", async () => {
    const { vault, governor, ousd } = fixture;

    // Pretend OUSD is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(ousd.address)
    ).to.be.revertedWith("Strategy not approved");
  });

  it("Should correctly handle a mint with auto rebase", async function () {
    const { ousd, vault, usdc, matt, anna } = fixture;

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await usdc.connect(anna).mint(usdcUnits("5000.0"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("5000.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("5000.0"), 0);
    await expect(anna).has.a.balanceOf("5000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should revert mint if minMintAmount check fails", async () => {
    const { vault, matt, ousd, usds, usdt } = fixture;

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await usds.connect(matt).approve(vault.address, usdsUnits("25.0"));

    await expect(
      vault.connect(matt).mint(usdt.address, usdtUnits("50"), usdsUnits("100"))
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor } = fixture;

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = fixture;

    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow governor to change rebase threshold", async () => {
    const { vault, governor } = fixture;

    await vault.connect(governor).setRebaseThreshold(ousdUnits("400"));
  });

  it("Should not allow non-governor to change rebase threshold", async () => {
    const { vault } = fixture;

    expect(vault.setRebaseThreshold(ousdUnits("400"))).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor to change Strategist address", async () => {
    const { vault, governor, josh } = fixture;

    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
  });

  it("Should not allow non-governor to change Strategist address", async () => {
    const { vault, josh, matt } = fixture;

    await expect(
      vault.connect(matt).setStrategistAddr(await josh.getAddress())
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow the Governor to call withdraw and then deposit", async () => {
    const { vault, governor, usds, josh, compoundStrategy } = fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all USDS to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usds.address, compoundStrategy.address);
    await usds.connect(josh).approve(vault.address, usdsUnits("200"));
    await vault.connect(josh).mint(usds.address, usdsUnits("200"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(governor)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usds.address],
        [usdsUnits("200")]
      );

    await vault
      .connect(governor)
      .depositToStrategy(
        compoundStrategy.address,
        [usds.address],
        [usdsUnits("200")]
      );
  });

  it("Should allow the Strategist to call withdrawFromStrategy and then depositToStrategy", async () => {
    const { vault, governor, usds, josh, strategist, compoundStrategy } =
      fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all USDS to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usds.address, compoundStrategy.address);
    await usds.connect(josh).approve(vault.address, usdsUnits("200"));
    await vault.connect(josh).mint(usds.address, usdsUnits("200"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(strategist)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usds.address],
        [usdsUnits("200")]
      );

    await vault
      .connect(strategist)
      .depositToStrategy(
        compoundStrategy.address,
        [usds.address],
        [usdsUnits("200")]
      );
  });

  it("Should not allow non-Governor and non-Strategist to call withdrawFromStrategy or depositToStrategy", async () => {
    const { vault, usds, josh } = fixture;

    await expect(
      vault.connect(josh).withdrawFromStrategy(
        vault.address, // Args don't matter because it doesn't reach checks
        [usds.address],
        [usdsUnits("200")]
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");

    await expect(
      vault.connect(josh).depositToStrategy(
        vault.address, // Args don't matter because it doesn't reach checks
        [usds.address],
        [usdsUnits("200")]
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should withdrawFromStrategy the correct amount for multiple assests and redeploy them using depositToStrategy", async () => {
    const {
      vault,
      governor,
      usds,
      usdc,
      cusdc,
      josh,
      strategist,
      compoundStrategy,
    } = fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all USDS to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usds.address, compoundStrategy.address);

    // Add USDC
    await compoundStrategy
      .connect(governor)
      .setPTokenAddress(usdc.address, cusdc.address);

    // Send all USDC to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, compoundStrategy.address);

    await usds.connect(josh).approve(vault.address, usdsUnits("200"));
    await vault.connect(josh).mint(usds.address, usdsUnits("200"), 0);
    await usdc.connect(josh).approve(vault.address, usdcUnits("90"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("90"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(strategist)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usds.address, usdc.address],
        [usdsUnits("50"), usdcUnits("90")]
      );

    // correct balances at the end
    const expectedVaultUsdsBalance = usdsUnits("50");
    expect(await usds.balanceOf(vault.address)).to.equal(
      expectedVaultUsdsBalance
    );
    const expectedVaultUsdcBalance = usdcUnits("90");
    expect(await usdc.balanceOf(vault.address)).to.equal(
      expectedVaultUsdcBalance
    );

    await vault
      .connect(strategist)
      .depositToStrategy(
        compoundStrategy.address,
        [usds.address, usdc.address],
        [usdsUnits("50"), usdcUnits("90")]
      );

    // correct balances after depositing back
    expect(await usds.balanceOf(vault.address)).to.equal(usdsUnits("0"));
    expect(await usdc.balanceOf(vault.address)).to.equal(usdcUnits("0"));
  });

  it("Should allow Governor and Strategist to set vaultBuffer", async () => {
    const { vault, governor, strategist } = fixture;
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("5", 17));
    await vault.connect(strategist).setVaultBuffer(utils.parseUnits("5", 17));
  });

  it("Should not allow other to set vaultBuffer", async () => {
    const { vault, josh } = fixture;
    await expect(
      vault.connect(josh).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should not allow setting a vaultBuffer > 1e18", async () => {
    const { vault, governor } = fixture;
    await expect(
      vault.connect(governor).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Invalid value");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategies", async () => {
    const { vault, governor, matt, strategist } = fixture;

    await vault.connect(governor).withdrawAllFromStrategies();
    await vault.connect(strategist).withdrawAllFromStrategies();
    await expect(
      vault.connect(matt).withdrawAllFromStrategies()
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategy", async () => {
    const { vault, governor, strategist, compoundStrategy, matt, josh, usds } =
      fixture;
    await vault.connect(governor).approveStrategy(compoundStrategy.address);

    // Get the vault's initial USDS balance.
    const vaultUsdsBalance = await usds.balanceOf(vault.address);

    // Mint and allocate USDS to Compound.
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usds.address, compoundStrategy.address);
    await usds.connect(josh).approve(vault.address, usdsUnits("200"));
    await vault.connect(josh).mint(usds.address, usdsUnits("200"), 0);
    await vault.connect(governor).allocate();

    // Call to withdrawAll by the governor should go thru.
    await vault
      .connect(governor)
      .withdrawAllFromStrategy(compoundStrategy.address);

    // All the USDS should have been moved back to the vault.
    const expectedVaultUsdsBalance = vaultUsdsBalance.add(usdsUnits("200"));
    await expect(await usds.balanceOf(vault.address)).to.equal(
      expectedVaultUsdsBalance
    );

    // Call to withdrawAll by the strategist should go thru.
    await vault
      .connect(strategist)
      .withdrawAllFromStrategy(compoundStrategy.address);

    // Call to withdrawAll from random dude matt should get rejected.
    await expect(
      vault.connect(matt).withdrawAllFromStrategy(compoundStrategy.address)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should only allow metastrategy to mint oTokens and revert when threshold is reached.", async () => {
    const { vault, ousd, governor, anna, josh } = fixture;

    await vault
      .connect(governor)
      .setNetOusdMintForStrategyThreshold(ousdUnits("10"));
    // Approve anna address as an address allowed to mint OUSD without backing
    await vault.connect(governor).setOusdMetaStrategy(anna.address);

    await expect(
      vault.connect(anna).mintForStrategy(ousdUnits("11"))
    ).to.be.revertedWith(
      "Minted ousd surpassed netOusdMintForStrategyThreshold."
    );

    await expect(
      vault.connect(josh).mintForStrategy(ousdUnits("9"))
    ).to.be.revertedWith("Caller is not the OUSD meta strategy");

    await vault.connect(anna).mintForStrategy(ousdUnits("9"));

    await expect(await ousd.balanceOf(anna.address)).to.equal(ousdUnits("9"));
  });

  it("Should reset netOusdMintedForStrategy when new threshold is set", async () => {
    const { vault, governor, anna } = fixture;

    await vault
      .connect(governor)
      .setNetOusdMintForStrategyThreshold(ousdUnits("10"));

    // Approve anna address as an address allowed to mint OUSD without backing
    await vault.connect(governor).setOusdMetaStrategy(anna.address);
    await vault.connect(anna).mintForStrategy(ousdUnits("9"));

    // netOusdMintedForStrategy should be equal to amount minted
    await expect(await vault.netOusdMintedForStrategy()).to.equal(
      ousdUnits("9")
    );

    await vault
      .connect(governor)
      .setNetOusdMintForStrategyThreshold(ousdUnits("10"));

    // netOusdMintedForStrategy should be reset back to 0
    await expect(await vault.netOusdMintedForStrategy()).to.equal(
      ousdUnits("0")
    );
  });
  it("Should re-cache decimals", async () => {
    const { vault, governor, usdc } = fixture;

    const beforeAssetConfig = await vault.getAssetConfig(usdc.address);
    expect(beforeAssetConfig.decimals).to.equal(6);

    // cacheDecimals is not on IVault so we need to use the admin contract
    const vaultAdmin = await ethers.getContractAt("VaultAdmin", vault.address);

    await vaultAdmin.connect(governor).cacheDecimals(usdc.address);

    const afterAssetConfig = await vault.getAssetConfig(usdc.address);
    expect(afterAssetConfig.decimals).to.equal(6);
  });
});
