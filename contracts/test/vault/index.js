const { defaultFixture } = require("../_fixture");
const chai = require("chai");
const hre = require("hardhat");
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
  getOracleAddresses,
  isFork,
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

describe("Vault", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should support an asset", async () => {
    const { vault, oracleRouter, ousd, governor } = await loadFixture(
      defaultFixture
    );
    const oracleAddresses = await getOracleAddresses(hre.deployments);
    const origAssetCount = await vault.connect(governor).getAssetCount();
    expect(await vault.isSupportedAsset(ousd.address)).to.be.false;
    await oracleRouter.setFeed(ousd.address, oracleAddresses.chainlink.DAI_USD);
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

  it("Should revert when adding a strategy that is already approved", async function () {
    const { vault, governor, compoundStrategy } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    await expect(
      vault.connect(governor).approveStrategy(compoundStrategy.address)
    ).to.be.revertedWith("Strategy already approved");
  });

  it("Should revert when attempting to approve a strategy and not Governor", async function () {
    const { vault, josh, compoundStrategy } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).approveStrategy(compoundStrategy.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should correctly ratio deposited currencies of differing decimals", async function () {
    const { ousd, vault, usdc, dai, matt } = await loadFixture(defaultFixture);

    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    await expect(matt).has.a.balanceOf("102.00", ousd);

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(vault.address, daiUnits("4.0"));
    await vault.connect(matt).mint(dai.address, daiUnits("4.0"), 0);
    await expect(matt).has.a.balanceOf("106.00", ousd);
  });

  it("Should correctly handle a deposit of DAI (18 decimals)", async function () {
    const { ousd, vault, dai, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // We limit to paying to $1 OUSD for for one stable coin,
    // so this will deposit at a rate of $1.
    await setOracleTokenPriceUsd("DAI", "1.30");
    await dai.connect(anna).approve(vault.address, daiUnits("3.0"));
    await vault.connect(anna).mint(dai.address, daiUnits("3.0"), 0);
    await expect(anna).has.a.balanceOf("3.00", ousd);
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await setOracleTokenPriceUsd("USDC", "0.96");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("48.00", ousd);
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
        .mint(nonStandardToken.address, usdtUnits("1500.0"), 0);
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
      .mint(nonStandardToken.address, usdtUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", ousd);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
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
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    // Fixture loads 200 DAI, so result should be 202
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("202", 18)
    );
  });

  it("Should calculate the balance correctly with USDT", async () => {
    const { vault, usdt, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("5.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("5.0"), 0);
    // Fixture loads 200 DAI, so result should be 205
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("205", 18)
    );
  });

  it("Should calculate the balance correctly with TUSD", async () => {
    const { vault, tusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"), 0);
    // Fixture loads 200 DAI, so result should be 209
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("209", 18)
    );
  });

  it("Should calculate the balance correctly with DAI, USDC, USDT, TUSD", async () => {
    const { vault, usdc, usdt, tusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(matt).mint(usdt.address, usdtUnits("20.0"), 0);
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"), 0);
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
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
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

  it("Should not allow transfer of supported token by governor", async () => {
    const { vault, usdc, governor } = await loadFixture(defaultFixture);
    // Matt puts USDC in vault
    await usdc.transfer(vault.address, usdcUnits("8.0"));
    // Governor cannot move USDC because it is a supported token.
    await expect(
      vault.connect(governor).transferToken(usdc.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Only unsupported assets");
  });

  it("Should allow Governor to add Strategy", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).approveStrategy(ousd.address);
  });

  it("Should revert when removing a Strategy that has not been added", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(ousd.address)
    ).to.be.revertedWith("Strategy not approved");
  });

  it("Should correctly handle a mint with auto rebase", async function () {
    const { ousd, vault, usdc, matt, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await usdc.connect(anna).mint(usdcUnits("5000.0"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("5000.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("5000.0"), 0);
    await expect(anna).has.a.balanceOf("5000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should revert mint/mintMultiple if minMintAmount check fails", async () => {
    const { vault, matt, ousd, dai, usdt } = await loadFixture(defaultFixture);

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await dai.connect(matt).approve(vault.address, daiUnits("25.0"));

    await expect(
      vault.connect(matt).mint(usdt.address, usdtUnits("50"), daiUnits("100"))
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(
      vault
        .connect(matt)
        .mintMultiple(
          [usdt.address, dai.address],
          [usdtUnits("50"), daiUnits("25")],
          daiUnits("100")
        )
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should mint for multiple tokens in a single call", async () => {
    const { vault, matt, ousd, dai, usdt } = await loadFixture(defaultFixture);

    await usdt.connect(matt).approve(vault.address, usdtUnits("50.0"));
    await dai.connect(matt).approve(vault.address, daiUnits("25.0"));

    await vault
      .connect(matt)
      .mintMultiple(
        [usdt.address, dai.address],
        [usdtUnits("50"), daiUnits("25")],
        0
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
        [usdtUnits("2500.00"), daiUnits("2500.00")],
        0
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
          [usdtUnits("50"), daiUnits("250")],
          0
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
        [daiUnits("105"), daiUnits("50"), daiUnits("92")],
        0
      );
    // Josh had 100 OUSD from the fixture
    await expect(josh).has.a.balanceOf("347", ousd);
    await expect(josh).has.a.balanceOf("653", dai);
  });

  it("Should not mint OUSD for unsupported assets in mintMultiple", async () => {
    const { vault, josh, nonStandardToken, dai } = await loadFixture(
      defaultFixture
    );
    await setOracleTokenPriceUsd("NonStandardToken", "1.00");
    await nonStandardToken
      .connect(josh)
      .approve(vault.address, usdtUnits("100.0"));
    await dai.connect(josh).approve(vault.address, daiUnits("50"));
    await expect(
      vault
        .connect(josh)
        .mintMultiple(
          [nonStandardToken.address, dai.address],
          [usdtUnits("100.0"), daiUnits("50")],
          0
        )
    ).to.be.revertedWith("Asset is not supported");
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor } = await loadFixture(
      defaultFixture
    );
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

  it("Should allow governor to change Strategist address", async () => {
    const { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
  });

  it("Should not allow non-governor to change Strategist address", async () => {
    const { vault, josh, matt } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(matt).setStrategistAddr(await josh.getAddress())
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow the Governor to call reallocate", async () => {
    const {
      vault,
      governor,
      dai,
      josh,
      compoundStrategy,
      aaveStrategy,
    } = await loadFixture(defaultFixture);

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all DAI to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(dai.address, compoundStrategy.address);
    await dai.connect(josh).approve(vault.address, daiUnits("200"));
    await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
    await vault.connect(governor).allocate();
    await vault.connect(governor).approveStrategy(aaveStrategy.address);

    await vault
      .connect(governor)
      .reallocate(
        compoundStrategy.address,
        aaveStrategy.address,
        [dai.address],
        [daiUnits("200")]
      );
  });

  it("Should allow the Strategist to call reallocate", async () => {
    const {
      vault,
      governor,
      dai,
      josh,
      compoundStrategy,
      aaveStrategy,
    } = await loadFixture(defaultFixture);

    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all DAI to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(dai.address, compoundStrategy.address);
    await dai.connect(josh).approve(vault.address, daiUnits("200"));
    await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
    await vault.connect(governor).allocate();
    await vault.connect(governor).approveStrategy(aaveStrategy.address);

    await vault
      .connect(josh)
      .reallocate(
        compoundStrategy.address,
        aaveStrategy.address,
        [dai.address],
        [daiUnits("200")]
      );
  });

  it("Should not allow non-Governor and non-Strategist to call reallocate", async () => {
    const { vault, dai, josh } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(josh).reallocate(
        vault.address, // Args don't matter because it doesn't reach checks
        vault.address,
        [dai.address],
        [daiUnits("200")]
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should allow Governor and Strategist to set vaultBuffer", async () => {
    const { vault, governor, strategist } = await loadFixture(defaultFixture);
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("5", 17));
    await vault.connect(strategist).setVaultBuffer(utils.parseUnits("5", 17));
  });

  it("Should not allow other to set vaultBuffer", async () => {
    const { vault, josh } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should not allow setting a vaultBuffer > 1e18", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Invalid value");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategies", async () => {
    const { vault, governor, matt, strategist } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).withdrawAllFromStrategies();
    await vault.connect(strategist).withdrawAllFromStrategies();
    await expect(
      vault.connect(matt).withdrawAllFromStrategies()
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategy", async () => {
    const {
      vault,
      governor,
      strategist,
      compoundStrategy,
      matt,
      josh,
      dai,
    } = await loadFixture(defaultFixture);
    await vault.connect(governor).approveStrategy(compoundStrategy.address);

    // Get the vault's initial DAI balance.
    const vaultDaiBalance = await dai.balanceOf(vault.address);

    // Mint and allocate DAI to Compound.
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(dai.address, compoundStrategy.address);
    await dai.connect(josh).approve(vault.address, daiUnits("200"));
    await vault.connect(josh).mint(dai.address, daiUnits("200"), 0);
    await vault.connect(governor).allocate();

    // Call to withdrawAll by the governor should go thru.
    await vault
      .connect(governor)
      .withdrawAllFromStrategy(compoundStrategy.address);

    // All the DAI should have been moved back to the vault.
    const expectedVaultDaiBalance = vaultDaiBalance.add(daiUnits("200"));
    await expect(await dai.balanceOf(vault.address)).to.equal(
      expectedVaultDaiBalance
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
});
