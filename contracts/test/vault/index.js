const { expect } = require("chai");
const { utils } = require("ethers");

const { loadDefaultFixture } = require("../_fixture");
const {
  ousdUnits,
  usdsUnits,
  usdcUnits,
  isFork,
} = require("../helpers");

describe("Vault", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
    await fixture.compoundStrategy
      .connect(fixture.governor)
      .setPTokenAddress(fixture.usdc.address, fixture.cusdc.address);
  });

  it("Should support an asset", async () => {
    const { vault, usdc, usds } = fixture;

    expect(await vault.isSupportedAsset(usds.address)).to.be.false;
    expect(await vault.isSupportedAsset(usdc.address)).to.be.true;
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
    const { ousd, vault, usdc, matt } = fixture;
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    await expect(matt).has.a.balanceOf("102.00", ousd);
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);
  });

  it("Should calculate the balance correctly with USDC", async () => {
    const { vault, usdc, matt } = fixture;

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
    // Fixture loads 200 USDS, so result should be 202
    expect(await vault.totalValue()).to.equal(utils.parseUnits("202", 18));
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
    ).to.be.revertedWith("Only unsupported backingAsset");
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
    const { vault, matt, ousd, usdc } = fixture;

    await expect(
      vault.connect(matt).mint(usdc.address, usdcUnits("50"), ousdUnits("100"))
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
    const { vault, governor, usdc, josh, compoundStrategy } = fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all USDC to Compound
    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await usdc.connect(josh).approve(vault.address, usdcUnits("200"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("200"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(governor)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("200")]
      );

    await vault
      .connect(governor)
      .depositToStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("200")]
      );
  });

  it("Should allow the Strategist to call withdrawFromStrategy and then depositToStrategy", async () => {
    const { vault, governor, usdc, josh, strategist, compoundStrategy } =
      fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);
    // Send all USDC to Compound
    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await usdc.connect(josh).approve(vault.address, usdcUnits("200"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("200"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(strategist)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("200")]
      );

    await vault
      .connect(strategist)
      .depositToStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("200")]
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
    const { vault, governor, usdc, josh, strategist, compoundStrategy } =
      fixture;

    await vault.connect(governor).approveStrategy(compoundStrategy.address);

    // Send all USDC to Compound
    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);

    await usdc.connect(josh).approve(vault.address, usdcUnits("90"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("90"), 0);
    await vault.connect(governor).allocate();

    await vault
      .connect(strategist)
      .withdrawFromStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("90")]
      );

    // correct balances at the end
    const expectedVaultUsdcBalance = usdcUnits("90");
    expect(await usdc.balanceOf(vault.address)).to.equal(
      expectedVaultUsdcBalance
    );

    await vault
      .connect(strategist)
      .depositToStrategy(
        compoundStrategy.address,
        [usdc.address],
        [usdcUnits("90")]
      );

    // correct balances after depositing back
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
    const { vault, governor, strategist, compoundStrategy, matt, josh, usdc } =
      fixture;
    await vault.connect(governor).approveStrategy(compoundStrategy.address);

    // Get the vault's initial USDC balance.
    const vaultUsdcBalance = await usdc.balanceOf(vault.address);

    // Mint and allocate USDC to Compound.
    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await usdc.connect(josh).approve(vault.address, usdcUnits("200"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("200"), 0);
    await vault.connect(governor).allocate();

    // Call to withdrawAll by the governor should go thru.
    await vault
      .connect(governor)
      .withdrawAllFromStrategy(compoundStrategy.address);

    // All the USDC should have been moved back to the vault.
    const expectedVaultUsdsBalance = vaultUsdcBalance.add(usdcUnits("200"));
    await expect(await usdc.balanceOf(vault.address)).to.equal(
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
});
