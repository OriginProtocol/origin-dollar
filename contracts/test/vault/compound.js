const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, compoundVaultFixture } = require("../_fixture");

const {
  advanceTime,
  ousdUnits,
  usdsUnits,
  usdcUnits,
  setOracleTokenPriceUsd,
  isFork,
  expectApproxSupply,
} = require("../helpers");
const {
  increase,
} = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");

describe("Vault with Compound strategy", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  const loadFixture = createFixtureLoader(compoundVaultFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Anyone can call safeApproveAllTokens", async () => {
    const { matt, compoundStrategy } = fixture;
    await compoundStrategy.connect(matt).safeApproveAllTokens();
  });

  it("Governor can call removePToken", async () => {
    const { governor, compoundStrategy } = fixture;

    const tx = await compoundStrategy.connect(governor).removePToken(0);

    await expect(tx).to.emit(compoundStrategy, "PTokenRemoved");
  });

  it("Governor can call setPTokenAddress", async () => {
    const { usdc, ousd, matt, compoundStrategy } = fixture;

    await expect(
      compoundStrategy
        .connect(matt)
        .setPTokenAddress(ousd.address, usdc.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const { matt, compoundStrategy } = fixture;

    await expect(
      compoundStrategy.connect(matt).collectRewardTokens()
    ).to.be.revertedWith("Caller is not the Harvester");
  });

  it("Should allocate unallocated assets", async () => {
    const { anna, governor, usdc, vault, compoundStrategy } = fixture;

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await usdc.connect(anna).transfer(vault.address, usdcUnits("100"));
    await expect(vault.connect(governor).allocate())
      .to.emit(vault, "AssetAllocated")
      .withArgs(usdc.address, compoundStrategy.address, usdcUnits("300"));

    // Note compoundVaultFixture sets up with 200 USDC already in the Strategy
    // 200 + 100 = 300
    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("300"));
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { anna, ousd, usdc, vault } = fixture;

    await expect(anna).has.a.balanceOf("0", ousd);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault
      .connect(anna)
      .mint(usdc.address, usdcUnits("50"), ousdUnits("50"));
    await expect(anna).has.a.balanceOf("50", ousd);
  });

  it("Should allow withdrawals", async () => {
    const { strategist, ousd, usdc, vault } = fixture;

    await expect(strategist).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(strategist).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(strategist).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(strategist).has.a.balanceOf("50.00", ousd);

    await ousd.connect(strategist).approve(vault.address, ousdUnits("40.0"));
    await vault.connect(strategist).requestWithdrawal(ousdUnits("40.0"));
    await increase(60 * 10); // Advance 10 minutes
    await vault.connect(strategist).claimWithdrawal(0); // Assumes request ID is 0

    await expect(strategist).has.an.balanceOf("10", ousd);
    await expect(strategist).has.an.balanceOf("990.0", usdc);
  });

  it("Should calculate the balance correctly with USDC in strategy", async () => {
    const { usdc, vault, josh, compoundStrategy, governor } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits USDC, 6 decimals
    await usdc.connect(josh).approve(vault.address, usdcUnits("22.0"));
    await vault.connect(josh).mint(usdc.address, usdcUnits("22.0"), 0);

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.connect(governor).allocate();

    // Josh had 1000 USDC but used 100 USDC to mint OUSD in the fixture
    await expect(josh).has.an.approxBalanceOf("878.0", usdc, "Josh has less");

    // Verify the deposit went to Compound (as well as existing Vault assets)
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("222")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("222", 18)
    );
  });

  it("Should calculate the balance correct with USDC in Vault and USDC in Compound strategy", async () => {
    const { usdc, vault, matt, anna, governor, compoundStrategy } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.connect(governor).allocate();
    // Existing 200 also ends up in strategy due to allocate call
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("200")
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    await vault.connect(governor).allocate();
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("208.0")
    );
    // Anna deposits USDC that will stay in the Vault, 6 decimals
    await usdc.connect(anna).approve(vault.address, usdcUnits("10.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("10.0"), 0);
    expect(await usdc.balanceOf(vault.address)).to.approxEqual(
      usdcUnits("10.0")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("218", 18)
    );
  });

  it("Should correctly rebase with changes in Compound exchange rates", async () => {
    // Mocks can't handle increasing time
    if (!isFork) return;

    const { vault, matt, usds, governor } = fixture;

    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
    await usds.connect(matt).approve(vault.address, usdsUnits("100"));
    await vault.connect(matt).mint(usds.address, usdsUnits("100"), 0);

    await vault.connect(governor).allocate();

    await expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("300", 18)
    );

    // Advance one year
    await advanceTime(365 * 24 * 24 * 60);

    // Rebase OUSD
    await vault.rebase();

    // Expect a yield > 2%
    await expect(await vault.totalValue()).gt(utils.parseUnits("306", 18));
  });

  it("Should correctly withdrawAll all assets in Compound strategy", async () => {
    const { usdc, vault, matt, compoundStrategy, governor } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("208.0")
    );
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );
    await compoundStrategy.connect(governor).withdrawAll();

    // There should be no USDS or USDC left in compound strategy
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(0);

    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );
  });

  it("Should withdrawAll assets in Strategy and return them to Vault on removal", async () => {
    const { usdc, vault, matt, compoundStrategy, governor } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("208.0")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );

    expect(await vault.getStrategyCount()).to.equal(1);

    await vault
      .connect(governor)
      .setDefaultStrategy("0x0000000000000000000000000000000000000000");
    await vault.connect(governor).removeStrategy(compoundStrategy.address);

    expect(await vault.getStrategyCount()).to.equal(0);
    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );

    // Should be able to add Strategy back. Proves the struct in the mapping
    // was updated i.e. isSupported set to false
    await vault.connect(governor).approveStrategy(compoundStrategy.address);
  });

  it("Should not alter balances after an asset price change", async () => {
    let { ousd, vault, matt, usdc } = fixture;

    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"), 0);

    // 200 OUSD was already minted in the fixture, 100 each for Matt and Josh
    await expectApproxSupply(ousd, ousdUnits("400.0"));
    // 100 + 200 = 300
    await expect(matt).has.an.approxBalanceOf("300", ousd, "Initial");

    await setOracleTokenPriceUsd("USDC", "1.30");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf(
      "300.00",
      ousd,
      "After some assets double"
    );

    await setOracleTokenPriceUsd("USDC", "1.00");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf(
      "300.00",
      ousd,
      "After assets go back"
    );
  });

  it("Should never allocate anything when Vault buffer is 1e18 (100%)", async () => {
    const { usds, vault, governor, compoundStrategy } = fixture;

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 18));
    await vault.allocate();

    // Verify that nothing went to compound
    await expect(await compoundStrategy.checkBalance(usds.address)).to.equal(0);
  });

  it("Should allocate correctly with USDC when Vault buffer is 1e17 (10%)", async () => {
    const { usdc, vault, governor, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.allocate();

    // Verify 80% went to Compound
    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("180"));
    // Remaining 20 should be in Vault
    await expect(await vault.totalValue()).to.approxEqual(ousdUnits("200"));
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, compoundStrategy, ousd, usdc, matt, governor } = fixture;

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Strategy
    await ousd
      .connect(matt)
      .transfer(compoundStrategy.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await compoundStrategy
      .connect(governor)
      .transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { compoundStrategy, ousd, matt } = fixture;

    // Naughty Matt
    await expect(
      compoundStrategy
        .connect(matt)
        .transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should have correct balances on consecutive mint and redeem", async () => {
    const { ousd, vault, usdc, anna, matt, josh, governor } = fixture;

    const testCases = [
      { user: anna, start: 0 },
      { user: matt, start: 100 },
      { user: josh, start: 100 },
    ];
    const amounts = [5.09, 10.32, 20.99, 100.01];

    for (const { user, start } of testCases) {
      for (const amount of amounts) {
        const mintAmount = usdcUnits(amount.toString());
        await usdc.connect(user).approve(vault.address, mintAmount);
        await vault.connect(user).mint(usdc.address, mintAmount, 0);
        await expect(user).has.an.approxBalanceOf(
          (start + amount).toString(),
          ousd
        );
        await vault.connect(governor).setStrategistAddr(user.address);
        await vault
          .connect(user)
          .requestWithdrawal(ousdUnits(amount.toString()));
        await expect(user).has.an.approxBalanceOf(start.toString(), ousd);
      }
    }
  });

  const mintDoesAllocate = async (amount) => {
    const { anna, vault, usdc, governor, compoundStrategy } = fixture;

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.connect(governor).setVaultBuffer(0);
    await vault.allocate();
    await usdc.connect(anna).mint(usdcUnits(amount));
    await usdc.connect(anna).approve(vault.address, usdcUnits(amount));
    await vault.connect(anna).mint(usdc.address, usdcUnits(amount), 0);
    return (await usdc.balanceOf(vault.address)).isZero();
  };

  const setThreshold = async (amount) => {
    const { vault, governor } = fixture;
    await vault.connect(governor).setAutoAllocateThreshold(ousdUnits(amount));
  };

  it("Triggers auto allocation at the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25000")).to.be.true;
  });

  it("Alloc with both threshold and buffer", async () => {
    const { anna, vault, usdc, usds, governor, compoundStrategy } = fixture;

    await vault.connect(governor).setDefaultStrategy(compoundStrategy.address);
    await vault.allocate();
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.connect(governor).setAutoAllocateThreshold(ousdUnits("3"));

    const amount = "4";
    await usdc.connect(anna).mint(usdcUnits(amount));
    await usdc.connect(anna).approve(vault.address, usdcUnits(amount));
    await vault.connect(anna).mint(usdc.address, usdcUnits(amount), 0);
    // No allocate triggered due to threshold so call manually
    await vault.allocate();

    // 5 should be below the 10% vault buffer (4/204 * 100 = 1.96%)
    // All funds should remain in vault
    expect(await usdc.balanceOf(vault.address)).to.equal(usdcUnits(amount));
    // USDS was allocated before the vault buffer was set
    expect(await usds.balanceOf(vault.address)).to.equal(usdsUnits("0"));

    // Use an amount above the vault buffer size that will trigger an allocate
    const allocAmount = "5000";
    await usdc.connect(anna).mint(usdcUnits(allocAmount));
    await usdc.connect(anna).approve(vault.address, usdcUnits(allocAmount));
    await vault.connect(anna).mint(usdc.address, usdcUnits(allocAmount), 0);

    // We should take 10% off for the buffer
    // 10% * 5204
    await expect(await usdc.balanceOf(vault.address)).to.equal(
      usdcUnits("520.4")
    );

    const minAmount = "0.000001";
    await usdc.connect(anna).mint(usdcUnits(minAmount));
    await usdc.connect(anna).approve(vault.address, usdcUnits(minAmount));
    await vault.connect(anna).mint(usdc.address, usdcUnits(minAmount), 0);

    //alloc should not crash here
    await expect(vault.allocate()).not.to.be.reverted;
  });

  it("Triggers auto allocation above the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25001")).to.be.true;
  });

  it("Does not trigger auto allocation below the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("24999")).to.be.false;
  });

  it("Governor can change the threshold", async () => {
    await setThreshold("25000");
  });

  it("Non-governor cannot change the threshold", async () => {
    const { vault, anna } = fixture;
    await expect(vault.connect(anna).setAutoAllocateThreshold(10000)).to.be
      .reverted;
  });
});
