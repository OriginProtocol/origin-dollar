const { expect } = require("chai");
const { utils } = require("ethers");

const { aaveVaultFixture, aaveFixture } = require("../_fixture");
const {
  usdcUnits,
  daiUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");

describe("Aave Strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  let anna,
    matt,
    josh,
    ousd,
    vault,
    governor,
    adai,
    aaveStrategy,
    usdt,
    usdc,
    dai,
    cusdc,
    cdai,
    aaveAddressProvider,
    aaveCoreAddress;

  const emptyVault = async () => {
    await vault.connect(matt).redeemAll();
    await vault.connect(josh).redeemAll();
  };

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).mint(asset.address, units(amount, asset));
  };

  beforeEach(async function () {
    const fixture = await loadFixture(aaveVaultFixture);
    anna = fixture.anna;
    matt = fixture.matt;
    josh = fixture.josh;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    aaveStrategy = fixture.aaveStrategy;
    adai = fixture.adai;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    cdai = fixture.cdai;
    dai = fixture.dai;
    cusdc = fixture.cusdc;
    aaveAddressProvider = fixture.aaveAddressProvider;
    aaveCoreAddress = await aaveAddressProvider.getLendingPoolCore();
  });
  
  async function loadAaveFixtureNoVault() {
    const fixture = await loadFixture(aaveFixture);
    anna = fixture.anna;
    matt = fixture.matt;
    josh = fixture.josh;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    aaveStrategy = fixture.aaveStrategy;
    adai = fixture.adai;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    cdai = fixture.cdai;
    dai = fixture.dai;
    cusdc = fixture.cusdc;
    aaveAddressProvider = fixture.aaveAddressProvider;
    aaveCoreAddress = await aaveAddressProvider.getLendingPoolCore();
  }

  describe("Mint", function () {
    it("Should be able to mint DAI and it should show up in the aave core", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      // we already have 200 dai in vault
      await expect(vault).has.an.approxBalanceOf("200", dai);
      await mint("30000.00", dai);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      // should allocate all of it to strategy
      await expect(aaveStrategy).has.an.approxBalanceOf("30200", adai);
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      expect(await dai.balanceOf(aaveCoreAddress)).to.be.equal(
        utils.parseUnits("30200", 18)
      );
    });

    it("Should not send USDC to aave strategy", async function () {
      await emptyVault();
      // should be all empty
      await expectApproxSupply(ousd, ousdUnits("0"));
      await mint("30000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("30000"));
      await expect(aaveStrategy).has.an.approxBalanceOf("0", dai);
      await vault.connect(anna).redeem(ousdUnits("30000.00"));
    });

    it("Should be able to mint and redeem DAI", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      const startBalance = await dai.balanceOf(anna._address);
      // empty out anna
      await dai.connect(anna).transfer(matt._address, startBalance);

      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("20000"));
      await expectApproxSupply(ousd, ousdUnits("10200"));
      await expect(anna).to.have.a.balanceOf("20000", dai);
      await expect(anna).to.have.a.balanceOf("10000", ousd);
    });

    it("Should be able to redeem and return assets after multiple mints", async function () {
      await mint("30000.00", usdt);
      await mint("30000.00", usdc);
      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("60000.00"));
      // Anna had 1000 of each asset before the mints
      // 200 DAI was already in the Vault
      // 30200 DAI, 30000 USDT, 30000 USDC
      // 30200 / 90200 * 30000 + 1000 DAI
      // 30000 / 90200 * 30000 + 1000 USDC and USDT
      await expect(anna).to.have.an.approxBalanceOf("21088.69", dai);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdc);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
    });

    it("Should allow transfer of arbitrary token by Governor", async () => {
      await dai.connect(anna).approve(vault.address, daiUnits("8.0"));
      await vault.connect(anna).mint(dai.address, daiUnits("8.0"));
      // Anna sends her OUSD directly to Strategy
      await ousd.connect(anna).transfer(aaveStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await aaveStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });
    
    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        aaveStrategy.connect(anna).transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Liquidate", function () {
    it("Should liquidate a single asset", async () => {
      // Use govenor as the controller
      await loadAaveFixtureNoVault();

      const fakeVault = governor;

      // Add usdc
      await aaveStrategy
        .connect(fakeVault)
        .setPTokenAddress(usdc.address, cusdc.address);

      // Give the strategy some funds
      await usdc
        .connect(fakeVault)
        .transfer(aaveStrategy.address, usdcUnits("1000"));
      await dai
        .connect(fakeVault)
        .transfer(aaveStrategy.address, daiUnits("1000"));

      // Run deposit()
      await aaveStrategy
        .connect(vault)
        .deposit(usdc.address, usdcUnits("1000"));
      await aaveStrategy
        .connect(vault)
        .deposit(dai.address, daiUnits("1000"));

      await expect(await cusdc.balanceOf(aaveStrategy.address)).to.be.above(
        "1000"
      );
      await expect(await cdai.balanceOf(aaveStrategy.address)).to.be.above(
        "1000"
      );

      await aaveStrategy
        .connect(vault)
        ['liquidate(address)'](usdc.address);
      await expect(await cusdc.balanceOf(aaveStrategy.address)).to.be.equal(
        '0'
      );
      await expect(await cdai.balanceOf(aaveStrategy.address)).to.be.above(
        "1000"
      );
    });
  
    it("Should deprecate an asset, but not a last remaining asset", async () => {
      // Add usdc
      await aaveStrategy
        .connect(governor)
        .setPTokenAddress(usdc.address, cusdc.address);

      await expect(await aaveStrategy.assetsMappedCount()).to.be.equal('2');
      await expect(await aaveStrategy.assetsMapped('0')).to.be.equal(dai.address);
      await expect(await aaveStrategy.assetsMapped('1')).to.be.equal(usdc.address);
      
      await aaveStrategy.connect(governor).deprecateAsset(dai.address);
      
      await expect(await aaveStrategy.assetsMappedCount()).to.be.equal('1');
      await expect(await aaveStrategy.assetsMapped('0')).to.be.equal(usdc.address);
      
      await expect(
        aaveStrategy.connect(governor).deprecateAsset(usdc.address)
      ).to.be.revertedWith("Can't deprecate one remaining asset");
    });
    
    it("Should liquidate all assets", async () => {
      // Use govenor as the controller
      await loadAaveFixtureNoVault();

      const fakeVault = governor;

      // Add usdc
      await aaveStrategy
        .connect(fakeVault)
        .setPTokenAddress(usdc.address, cusdc.address);

      // Give the strategy some funds
      await usdc
        .connect(fakeVault)
        .transfer(aaveStrategy.address, usdcUnits("1000"));
      await dai
        .connect(vault)
        .transfer(aaveStrategy.address, daiUnits("1000"));
      
      // Run deposit()
      await aaveStrategy
        .connect(vault)
        .deposit(usdc.address, usdcUnits("1000"));
      await aaveStrategy
        .connect(vault)
        .deposit(dai.address, daiUnits("1000"));
      
      await expect(await cusdc.balanceOf(aaveStrategy.address)).to.be.above(
        "1000"
      );
      await expect(await cdai.balanceOf(aaveStrategy.address)).to.be.above(
        "1000"
      );
      
      await aaveStrategy
        .connect(vault)
        ['liquidate()']();

      await expect(await cusdc.balanceOf(aaveStrategy.address)).to.be.equal(
        '0'
      );
      await expect(await cdai.balanceOf(aaveStrategy.address)).to.be.equal(
        "0"
      );
    });
    // Rewards for Aave is done throught the referral program
  });
});
