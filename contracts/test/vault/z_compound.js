const { compoundVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { BigNumber, utils } = require("ethers");

const {
  advanceTime,
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  isGanacheFork,
  expectApproxSupply,
} = require("../helpers");

describe("Vault with Compound strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should deposit supported assets into Compound and mint corresponding cToken", async () => {
    const { dai, vault, matt } = await loadFixture(compoundVaultFixture);
    // Mint OUSD
    await dai.connect(matt).approve(vault.address, daiUnits("100"));
    await vault.connect(matt).mint(dai.address, daiUnits("100"));

    /* TODO
      const cDAI = await ethers.getContract("MockCDAI");
      const exchangeRateFactor = isGanacheFork ? 1 : (100002 * 10 ** 13) / 1e18;
      expect(Number(await cDAI.balanceOf(compoundStrategy.address))).to.equal(
        utils.parseUnits("100", 8) / exchangeRateFactor
      );
      */
  });

  it("Anyone can call safeApproveAllTokens", async () => {
    const { matt, compoundStrategy } = await loadFixture(compoundVaultFixture);
    await compoundStrategy.connect(matt).safeApproveAllTokens();
  });

  it("Only Governor can call setPTokenAddress", async () => {
    const { dai, ousd, matt, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );
    await expect(
      compoundStrategy.connect(matt).setPTokenAddress(ousd.address, dai.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const { matt, compoundStrategy } = await loadFixture(compoundVaultFixture);
    await expect(
      compoundStrategy.connect(matt).collectRewardToken()
    ).to.be.revertedWith("Caller is not the Vault");
  });

  it("Should allocate unallocated assets", async () => {
    const {
      anna,
      governor,
      dai,
      usdc,
      usdt,
      tusd,
      vault,
      compoundStrategy,
    } = await loadFixture(compoundVaultFixture);

    await dai.connect(anna).transfer(vault.address, daiUnits("100"));
    await usdc.connect(anna).transfer(vault.address, usdcUnits("200"));
    await usdt.connect(anna).transfer(vault.address, usdtUnits("300"));
    await tusd.connect(anna).transfer(vault.address, tusdUnits("400"));

    await vault.connect(governor).allocate();

    // Note compoundVaultFixture sets up with 200 DAI already in the Strategy
    // 200 + 100 = 300
    await expect(
      await compoundStrategy.checkBalance(dai.address)
    ).to.approxEqual(daiUnits("300"));
    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("200"));
    await expect(
      await compoundStrategy.checkBalance(usdt.address)
    ).to.approxEqual(usdtUnits("300"));

    // Strategy doesn't support TUSD
    // Vault balance for TUSD should remain unchanged
    await expect(await tusd.balanceOf(vault.address)).to.equal(
      tusdUnits("400")
    );
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { anna, ousd, usdc, vault } = await loadFixture(compoundVaultFixture);
    await expect(anna).has.a.balanceOf("0", ousd);
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await setOracleTokenPriceUsd("USDC", "3.00");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50"));
    await expect(anna).has.a.balanceOf("150", ousd);
  });

  it("Should allow withdrawals", async () => {
    const {
      anna,
      compoundStrategy,
      ousd,
      usdc,
      vault,
      governor,
    } = await loadFixture(compoundVaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);

    await vault.connect(governor).allocate();

    // Verify the deposit went to Compound
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("50.0")
    );

    // Note Anna will have slightly less than 50 due to deposit to Compound
    // according to the MockCToken implementation
    await ousd.connect(anna).approve(vault.address, ousdUnits("40.0"));
    await vault.connect(anna).redeem(ousdUnits("40.0"));

    await expect(anna).has.an.approxBalanceOf("10", ousd);
    // Vault has 200 DAI and 50 USDC, 50/250 * 40 USDC will come back
    await expect(anna).has.an.approxBalanceOf("958", usdc);
  });

  it("Should calculate the balance correctly with DAI in strategy", async () => {
    const {
      dai,
      vault,
      viewVault,
      josh,
      compoundStrategy,
      governor,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits DAI, 18 decimals
    await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
    await vault.connect(josh).mint(dai.address, daiUnits("22.0"));

    await vault.connect(governor).allocate();

    // Josh had 1000 DAI but used 100 DAI to mint OUSD in the fixture
    await expect(josh).has.an.approxBalanceOf("878.0", dai, "Josh has less");

    // Verify the deposit went to Compound (as well as existing Vault assets)
    expect(await compoundStrategy.checkBalance(dai.address)).to.approxEqual(
      daiUnits("222")
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("222", 18)
    );
  });

  it("Should calculate the balance correctly with USDC in strategy", async () => {
    const {
      usdc,
      vault,
      viewVault,
      matt,
      compoundStrategy,
      governor,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));

    await vault.connect(governor).allocate();

    // Verify the deposit went to Compound
    await expect(matt).has.an.approxBalanceOf("992.0", usdc, "Matt has less");

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );
  });

  it("Should calculate the balance correct with TUSD in Vault and DAI, USDC, USDT in Compound strategy", async () => {
    const {
      tusd,
      usdc,
      dai,
      usdt,
      vault,
      viewVault,
      matt,
      josh,
      anna,
      governor,
      compoundStrategy,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits DAI, 18 decimals
    await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
    await vault.connect(josh).mint(dai.address, daiUnits("22.0"));
    await vault.connect(governor).allocate();
    // Existing 200 also ends up in strategy due to allocate call
    expect(await compoundStrategy.checkBalance(dai.address)).to.approxEqual(
      daiUnits("222")
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    await vault.connect(governor).allocate();
    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );
    // Anna deposits USDT, 6 decimals
    await usdt.connect(anna).approve(vault.address, usdtUnits("10.0"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("10.0"));
    await vault.connect(governor).allocate();
    expect(await compoundStrategy.checkBalance(usdt.address)).to.approxEqual(
      usdtUnits("10.0")
    );
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(vault.address, tusdUnits("9.0"));
    await vault.connect(matt).mint(tusd.address, tusdUnits("9.0"));

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("249", 18)
    );
  });

  it("Should correctly rebase with changes in Compound exchange rates", async () => {
    // Mocks can't handle increasing time
    if (!isGanacheFork) return;

    const { vault, viewVault, matt, dai, governor } = await loadFixture(
      compoundVaultFixture
    );
    await expect(await viewVault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
    await dai.connect(matt).approve(vault.address, daiUnits("100"));
    await vault.connect(matt).mint(dai.address, daiUnits("100"));

    await vault.connect(governor).allocate();

    await expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("300", 18)
    );

    // Advance one year
    await advanceTime(365 * 24 * 24 * 60);

    // Rebase OUSD
    await vault.rebase();

    // Expect a yield > 2%
    await expect(await viewVault.totalValue()).gt(utils.parseUnits("306", 18));
  });

  it("Should correctly liquidate all assets in Compound strategy", async () => {
    const {
      usdc,
      vault,
      viewVault,
      matt,
      josh,
      dai,
      compoundStrategy,
      governor,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8")
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );

    await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
    await vault.connect(josh).mint(dai.address, daiUnits("22.0"));

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(dai.address)).to.approxEqual(
      daiUnits("222")
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );

    await compoundStrategy.connect(governor).liquidate();

    // There should be no DAI or USDC left in compound strategy
    expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(0);
    expect(await compoundStrategy.checkBalance(dai.address)).to.equal(0);

    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );
  });

  it("Should liquidate assets in Strategy and return them to Vault on removal", async () => {
    const {
      usdc,
      vault,
      viewVault,
      matt,
      josh,
      dai,
      compoundStrategy,
      governor,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));

    await vault.connect(governor).allocate();

    expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
      usdcUnits("8.0")
    );
    await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
    await vault.connect(josh).mint(dai.address, daiUnits("22.0"));

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    await vault.connect(governor).removeStrategy(compoundStrategy.address);

    await expect(await vault.getStrategyCount()).to.equal(0);

    // Vault value should remain the same because the liquidattion sent the
    // assets back to the vault
    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("230", 18)
    );
  });

  it("Should calculate an APY for a single asset", async () => {
    const { usdc, vault, viewVault, matt, governor } = await loadFixture(
      compoundVaultFixture
    );

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Nothing in Compound Strategy
    await expect(await viewVault.getAPR()).to.equal(0);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("200.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200.0"));

    await expect(await vault.getStrategyCount()).to.equal(1);
    await vault.connect(governor).allocate();

    // Approx 3% APR on Compound assets due to MockCToken implementation
    await expect(await viewVault.getAPR()).to.approxEqual(
      // 14100000000 is hard coded supply rate
      // TODO make this work with mainnet fork
      BigNumber.from("14100000000").mul(2102400)
    );
  });

  it("Should alter balances after an asset price change", async () => {
    let { ousd, vault, matt, usdc, dai } = await loadFixture(
      compoundVaultFixture
    );

    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"));
    await dai.connect(matt).approve(vault.address, daiUnits("200"));
    await vault.connect(matt).mint(dai.address, daiUnits("200"));

    // 200 OUSD was already minted in the fixture, 100 each for Matt and Josh
    await expectApproxSupply(ousd, ousdUnits("600.0"));
    // 100 + 200 + 200
    await expect(matt).has.an.approxBalanceOf("500", ousd, "Initial");

    await setOracleTokenPriceUsd("USDC", "2.00");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("800.0"));
    await expect(matt).has.an.approxBalanceOf(
      "666.66",
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
    let {
      ousd,
      vault,
      matt,
      oracle,
      nonStandardToken,
      governor,
    } = await loadFixture(compoundVaultFixture);

    if (nonStandardToken) {
      await vault.connect(governor).supportAsset(nonStandardToken.address);
    }

    await setOracleTokenPriceUsd("NonStandardToken", "1.00");

    await nonStandardToken
      .connect(matt)
      .approve(vault.address, usdtUnits("10000"));

    // Try to mint more than balance, to check failure state
    try {
      await vault
        .connect(matt)
        .mint(nonStandardToken.address, usdtUnits("1200"));
    } catch (err) {
      expect(
        /revert SafeERC20: ERC20 operation did not succeed/gi.test(err.message)
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expectApproxSupply(ousd, ousdUnits("200.0"));
      await expect(matt).has.an.approxBalanceOf("100", ousd);
      await expect(matt).has.an.approxBalanceOf("1000", nonStandardToken);
    }

    // Try minting with a valid balance of tokens
    await vault.connect(matt).mint(nonStandardToken.address, usdtUnits("100"));
    await expect(matt).has.an.approxBalanceOf("900", nonStandardToken);

    await expectApproxSupply(ousd, ousdUnits("300.0"));
    await expect(matt).has.an.approxBalanceOf("200", ousd, "Initial");
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("200", ousd, "After null rebase");
    await setOracleTokenPriceUsd("NonStandardToken", "2.00");
    await vault.rebase();

    await expectApproxSupply(ousd, ousdUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf(
      "266.66",
      ousd,
      "After some assets double"
    );
  });

  it("Should never allocate anything when Vault buffer is 1e18 (100%)", async () => {
    const { dai, vault, governor, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 18));
    await vault.allocate();

    // Verify that nothing went to compound
    await expect(await compoundStrategy.checkBalance(dai.address)).to.equal(0);
  });

  it("Should allocate correctly with DAI when Vault buffer is 1e17 (10%)", async () => {
    const {
      dai,
      vault,
      viewVault,
      governor,
      compoundStrategy,
    } = await loadFixture(compoundVaultFixture);

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.allocate();

    // Verify 80% went to Compound
    await expect(
      await compoundStrategy.checkBalance(dai.address)
    ).to.approxEqual(ousdUnits("180"));
    // Remaining 20 should be in Vault
    await expect(await viewVault.totalValue()).to.approxEqual(ousdUnits("200"));
  });

  it("Should allocate correctly with DAI, USDT, USDC when Vault Buffer is 1e17 (10%)", async () => {
    const {
      dai,
      usdc,
      usdt,
      matt,
      josh,
      vault,
      viewVault,
      anna,
      governor,
      compoundStrategy,
    } = await loadFixture(compoundVaultFixture);

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits DAI, 18 decimals
    await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
    await vault.connect(josh).mint(dai.address, daiUnits("22.0"));
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    // Anna deposits USDT, 6 decimals
    await usdt.connect(anna).approve(vault.address, usdtUnits("20.0"));
    await vault.connect(anna).mint(usdt.address, usdtUnits("20.0"));

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.allocate();

    // Verify 80% went to Compound
    await expect(
      await compoundStrategy.checkBalance(dai.address)
    ).to.approxEqual(daiUnits("199.8"));

    await expect(
      await compoundStrategy.checkBalance(usdc.address)
    ).to.approxEqual(usdcUnits("7.2"));

    await expect(
      await compoundStrategy.checkBalance(usdt.address)
    ).to.approxEqual(usdtUnits("18"));

    expect(await viewVault.totalValue()).to.approxEqual(
      utils.parseUnits("250", 18)
    );
  });
});
