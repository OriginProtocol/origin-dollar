const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, compoundVaultFixture } = require("../_fixture");

const {
  advanceTime,
  ousdUnits,
  usdsUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  isFork,
  expectApproxSupply,
} = require("../helpers");
const addresses = require("../../utils/addresses");

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
    const { usds, ousd, matt, compoundStrategy } = fixture;

    await expect(
      compoundStrategy
        .connect(matt)
        .setPTokenAddress(ousd.address, usds.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const { matt, compoundStrategy } = fixture;

    await expect(
      compoundStrategy.connect(matt).collectRewardTokens()
    ).to.be.revertedWith("Caller is not the Harvester");
  });

  it("Should allocate unallocated assets", async () => {
    const { anna, governor, usds, usdc, usdt, tusd, vault, compoundStrategy } =
      fixture;

    await usds.connect(anna).transfer(vault.address, usdsUnits("100"));
    await usdc.connect(anna).transfer(vault.address, usdcUnits("200"));
    await usdt.connect(anna).transfer(vault.address, usdtUnits("300"));

    await tusd.connect(anna).mint(ousdUnits("1000.0"));
    await tusd.connect(anna).transfer(vault.address, tusdUnits("400"));

    await expect(vault.connect(governor).allocate())
      .to.emit(vault, "AssetAllocated")
      .withArgs(usds.address, compoundStrategy.address, usdsUnits("300"))
      .to.emit(vault, "AssetAllocated")
      .withArgs(usdc.address, compoundStrategy.address, usdcUnits("200"))
      .to.emit(vault, "AssetAllocated")
      .withArgs(usdt.address, compoundStrategy.address, usdcUnits("300"));
    /*
      TODO: There does not appear to be any support for .withoutArgs to verify
      that this event doesn't get emitted.
      .to.emit(vault, "AssetAllocated")
      .withoutArgs(usdt.address, compoundStrategy.address, tusdUnits("400"));
    */

    // Note compoundVaultFixture sets up with 200 USDS already in the Strategy
    // 200 + 100 = 300
    await expect(
      await compoundStrategy.checkBalance(usds.address)
    ).to.approxEqual(usdsUnits("300"));
    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("200"));
    await expect(
      await compoundStrategy.checkBalance(usdt.address)
    ).to.approxEqual(usdtUnits("300"));

    // Strategy doesn't support TUSD
    // Vault balance for TUSD should remain unchanged
    expect(await tusd.balanceOf(vault.address)).to.equal(tusdUnits("400"));
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { anna, ousd, usdc, vault } = fixture;

    await expect(anna).has.a.balanceOf("0", ousd);
    // The mint process maxes out at a 1.0 price
    await setOracleTokenPriceUsd("USDC", "1.25");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50"), 0);
    await expect(anna).has.a.balanceOf("50", ousd);
  });

  it("Should allow withdrawals", async () => {
    const { anna, compoundStrategy, ousd, usdc, vault, governor } = fixture;

    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);

    await vault.connect(governor).allocate();

    // Verify the deposit went to Compound
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("50.0")
    );

    // Note Anna will have slightly less than 50 due to deposit to Compound
    // according to the MockCToken implementation
    await ousd.connect(anna).approve(vault.address, ousdUnits("40.0"));
    await vault.connect(anna).redeem(ousdUnits("40.0"), 0);

    await expect(anna).has.an.approxBalanceOf("10", ousd);
    // Vault has 200 USDS and 50 USDC, 50/250 * 40 USDC will come back
    await expect(anna).has.an.approxBalanceOf("958", usdc);
  });

  it("Should calculate the balance correctly with USDS in strategy", async () => {
    const { usds, vault, josh, compoundStrategy, governor } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits USDS, 18 decimals
    await usds.connect(josh).approve(vault.address, usdsUnits("22.0"));
    await vault.connect(josh).mint(usds.address, usdsUnits("22.0"), 0);

    await vault.connect(governor).allocate();

    // Josh had 1000 USDS but used 100 USDS to mint OUSD in the fixture
    await expect(josh).has.an.approxBalanceOf("878.0", usds, "Josh has less");

    // Verify the deposit went to Compound (as well as existing Vault assets)
    expect(await compoundStrategy.checkBalance(usds.address)).to.approxEqual(
      usdsUnits("222")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("222", 18)
    );
  });

  it("Should calculate the balance correctly with USDC in strategy", async () => {
    const { usdc, vault, matt, compoundStrategy, governor } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);

    await vault.connect(governor).allocate();

    // Verify the deposit went to Compound
    await expect(matt).has.an.approxBalanceOf("992.0", usdc, "Matt has less");

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );
  });

  it("Should calculate the balance correct with TUSD in Vault and USDS, USDC, USDT in Compound strategy", async () => {
    const {
      tusd,
      usdc,
      usds,
      usdt,
      vault,
      matt,
      josh,
      anna,
      governor,
      compoundStrategy,
    } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits USDS, 18 decimals
    await usds.connect(josh).approve(vault.address, usdsUnits("22.0"));
    await vault.connect(josh).mint(usds.address, usdsUnits("22.0"), 0);
    await vault.connect(governor).allocate();
    // Existing 200 also ends up in strategy due to allocate call
    expect(await compoundStrategy.checkBalance(usds.address)).to.approxEqual(
      usdsUnits("222")
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    await vault.connect(governor).allocate();
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );
    // Anna deposits USDT, 6 decimals
    await usdt.connect(anna).approve(vault.address, usdtUnits("10.0"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("10.0"), 0);
    await vault.connect(governor).allocate();
    expect(await compoundStrategy.checkBalance(usdt.address)).to.approxEqual(
      usdtUnits("10.0")
    );
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).mint(ousdUnits("100.0"));
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"), 0);

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("249", 18)
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
    const { usdc, vault, matt, josh, usds, compoundStrategy, governor } =
      fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );

    await usds.connect(josh).approve(vault.address, usdsUnits("22.0"));
    await vault.connect(josh).mint(usds.address, usdsUnits("22.0"), 0);

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usds.address)).to.approxEqual(
      usdsUnits("222")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );

    await compoundStrategy.connect(governor).withdrawAll();

    // There should be no USDS or USDC left in compound strategy
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(0);
    expect(await compoundStrategy.checkBalance(usds.address)).to.equal(0);

    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );
  });

  it("Should withdrawAll assets in Strategy and return them to Vault on removal", async () => {
    const {
      usdt,
      usdc,
      comp,
      vault,
      matt,
      josh,
      usds,
      harvester,
      compoundStrategy,
      governor,
    } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    await harvester.connect(governor).setRewardTokenConfig(
      comp.address, // reward token
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 0,
        swapPlatformAddr: mockUniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      },
      utils.defaultAbiCoder.encode(
        ["address[]"],
        [[comp.address, usdt.address]]
      )
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );
    await usds.connect(josh).approve(vault.address, usdsUnits("22.0"));
    await vault.connect(josh).mint(usds.address, usdsUnits("22.0"), 0);

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdt.address, addresses.zero);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, addresses.zero);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usds.address, addresses.zero);
    await vault.connect(governor).removeStrategy(compoundStrategy.address);

    await expect(await vault.getStrategyCount()).to.equal(0);

    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );

    // Should be able to add Strategy back. Proves the struct in the mapping
    // was updated i.e. isSupported set to false
    await vault.connect(governor).approveStrategy(compoundStrategy.address);
  });

  it("Should not alter balances after an asset price change", async () => {
    let { ousd, vault, matt, usdc, usds } = fixture;

    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"), 0);
    await usds.connect(matt).approve(vault.address, usdsUnits("200"));
    await vault.connect(matt).mint(usds.address, usdsUnits("200"), 0);

    // 200 OUSD was already minted in the fixture, 100 each for Matt and Josh
    await expectApproxSupply(ousd, ousdUnits("600.0"));
    // 100 + 200 + 200
    await expect(matt).has.an.approxBalanceOf("500", ousd, "Initial");

    await setOracleTokenPriceUsd("USDC", "1.30");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("600.0"));
    await expect(matt).has.an.approxBalanceOf(
      "500.00",
      ousd,
      "After some assets double"
    );

    await setOracleTokenPriceUsd("USDC", "1.00");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("600.0"));
    await expect(matt).has.an.approxBalanceOf(
      "500",
      ousd,
      "After assets go back"
    );
  });

  it("Should handle non-standard token deposits", async () => {
    let { ousd, vault, matt, nonStandardToken, oracleRouter, governor } =
      fixture;

    await oracleRouter.cacheDecimals(nonStandardToken.address);
    if (nonStandardToken) {
      await vault.connect(governor).supportAsset(nonStandardToken.address, 0);
    }

    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(matt)
      .approve(vault.address, usdtUnits("10000"));

    // Try to mint more than balance, to check failure state
    try {
      await vault
        .connect(matt)
        .mint(nonStandardToken.address, usdtUnits("1200"), 0);
    } catch (err) {
      expect(
        /reverted with reason string 'SafeERC20: ERC20 operation did not succeed/gi.test(
          err.message
        )
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expectApproxSupply(ousd, ousdUnits("200.0"));
      await expect(matt).has.an.approxBalanceOf("100", ousd);
      await expect(matt).has.an.approxBalanceOf("1000", nonStandardToken);
    }

    // Try minting with a valid balance of tokens
    await vault
      .connect(matt)
      .mint(nonStandardToken.address, usdtUnits("100"), 0);
    await expect(matt).has.an.approxBalanceOf("900", nonStandardToken);

    await expectApproxSupply(ousd, ousdUnits("300.0"));
    await expect(matt).has.an.approxBalanceOf("200", ousd, "Initial");
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("200", ousd, "After null rebase");
    await setOracleTokenPriceUsd("NonStandardToken", "1.40");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("300.0"));
    await expect(matt).has.an.approxBalanceOf(
      "200.00",
      ousd,
      "After some assets double"
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

  it("Should allocate correctly with USDS when Vault buffer is 1e17 (10%)", async () => {
    const { usds, vault, governor, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.allocate();

    // Verify 80% went to Compound
    await expect(
      await compoundStrategy.checkBalance(usds.address)
    ).to.approxEqual(ousdUnits("180"));
    // Remaining 20 should be in Vault
    await expect(await vault.totalValue()).to.approxEqual(ousdUnits("200"));
  });

  it("Should allocate correctly with USDS, USDT, USDC when Vault Buffer is 1e17 (10%)", async () => {
    const {
      usds,
      usdc,
      usdt,
      matt,
      josh,
      vault,
      anna,
      governor,
      compoundStrategy,
    } = fixture;

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits USDS, 18 decimals
    await usds.connect(josh).approve(vault.address, usdsUnits("22.0"));
    await vault.connect(josh).mint(usds.address, usdsUnits("22.0"), 0);
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Anna deposits USDT, 6 decimals
    await usdt.connect(anna).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("20.0"), 0);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.allocate();

    // Verify 80% went to Compound
    await expect(
      await compoundStrategy.checkBalance(usds.address)
    ).to.approxEqual(usdsUnits("199.8"));

    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("7.2"));

    await expect(
      await compoundStrategy.checkBalance(usdt.address)
    ).to.approxEqual(usdtUnits("18"));

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("250", 18)
    );
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
    const { ousd, vault, usdc, usds, anna, matt, josh } = fixture;

    const usersWithBalances = [
      [anna, 0],
      [matt, 100],
      [josh, 100],
    ];

    const assetsWithUnits = [
      [usds, usdsUnits],
      [usdc, usdcUnits],
    ];

    for (const [user, startBalance] of usersWithBalances) {
      for (const [asset, units] of assetsWithUnits) {
        for (const amount of [5.09, 10.32, 20.99, 100.01]) {
          await asset
            .connect(user)
            .approve(vault.address, await units(amount.toString()));
          await vault
            .connect(user)
            .mint(asset.address, await units(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            (startBalance + amount).toString(),
            ousd
          );
          await vault.connect(user).redeem(ousdUnits(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            startBalance.toString(),
            ousd
          );
        }
      }
    }
  });

  it("Should collect reward tokens and swap via Uniswap", async () => {
    const { anna, vault, harvester, governor, compoundStrategy, comp, usdt } =
      fixture;

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    const compAmount = utils.parseUnits("100", 18);
    await comp.connect(governor).mint(compAmount);
    await comp.connect(governor).transfer(compoundStrategy.address, compAmount);

    await harvester.connect(governor).setRewardTokenConfig(
      comp.address, // reward token
      {
        allowedSlippageBps: 0,
        harvestRewardBps: 100,
        swapPlatformAddr: mockUniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      },
      utils.defaultAbiCoder.encode(
        ["address[]"],
        [[comp.address, usdt.address]]
      )
    );

    // Make sure Vault has 0 USDT balance
    await expect(vault).has.a.balanceOf("0", usdt);

    // Make sure the Strategy has COMP balance
    expect(await comp.balanceOf(await governor.getAddress())).to.be.equal("0");
    expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      compAmount
    );

    const balanceBeforeAnna = await usdt.balanceOf(anna.address);

    // prettier-ignore
    await harvester
      .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);

    const balanceAfterAnna = await usdt.balanceOf(anna.address);

    // Make sure Vault has 100 USDT balance (the Uniswap mock converts at 1:1)
    await expect(vault).has.a.balanceOf("99", usdt);

    // No COMP in Harvester or Compound strategy
    await expect(harvester).has.a.balanceOf("0", comp);
    expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal("0");
    expect(balanceAfterAnna - balanceBeforeAnna).to.be.equal(
      utils.parseUnits("1", 6)
    );
  });

  it("Should not swap if slippage is too high", async () => {
    const { josh, vault, harvester, governor, compoundStrategy, comp, usdt } =
      fixture;

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    // Mock router gives 1:1, if we set this to something high there will be
    // too much slippage
    await setOracleTokenPriceUsd("COMP", "1.3");

    const compAmount = utils.parseUnits("100", 18);
    await comp.connect(governor).mint(compAmount);
    await comp.connect(governor).transfer(compoundStrategy.address, compAmount);
    await mockUniswapRouter.setSlippage(utils.parseEther("0.75"));

    await harvester.connect(governor).setRewardTokenConfig(
      comp.address, // reward token
      {
        allowedSlippageBps: 0,
        harvestRewardBps: 100,
        swapPlatformAddr: mockUniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      },
      utils.defaultAbiCoder.encode(
        ["address[]"],
        [[comp.address, usdt.address]]
      )
    );
    // Make sure Vault has 0 USDT balance
    await expect(vault).has.a.balanceOf("0", usdt);

    // Make sure the Strategy has COMP balance
    expect(await comp.balanceOf(await governor.getAddress())).to.be.equal("0");
    expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      compAmount
    );

    // prettier-ignore
    await expect(harvester
      .connect(josh)["harvestAndSwap(address)"](compoundStrategy.address)).to.be.revertedWith("Slippage error");
  });

  const mintDoesAllocate = async (amount) => {
    const { anna, vault, usdc, governor } = fixture;

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
    const { anna, vault, usdc, usds, governor } = fixture;

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
    await expect(await usdc.balanceOf(vault.address)).to.equal(
      usdcUnits(amount)
    );
    // USDS was allocated before the vault buffer was set
    await expect(await usds.balanceOf(vault.address)).to.equal(usdsUnits("0"));

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
