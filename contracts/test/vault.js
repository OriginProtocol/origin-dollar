const {
  defaultFixture,
  mockVaultFixture,
  compoundVaultFixture,
} = require("./_fixture");
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
} = require("./helpers");

describe("Vault", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should support an asset", async () => {
    const { vault, ousd, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).supportAsset(ousd.address, "OUSD")
    ).to.emit(vault, "AssetSupported");
  });

  it("Should revert when adding an asset that is already supported", async function () {
    const { vault, usdt, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).supportAsset(usdt.address, "USDT")
    ).to.be.revertedWith("Asset already supported");
  });

  it("Should revert when attempting to support an asset and not governor", async function () {
    const { vault, usdt } = await loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address, "USDT")).to.be.revertedWith(
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

  it("Should allow withdrawals", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await ousd.connect(anna).approve(vault.address, ousdUnits("50.0"));
    await vault.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
  });

  it("Should allow withdrawals of non-standard tokens", async () => {
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

  describe("Rebase pausing", async () => {
    it("Should rebase when rebasing is not paused", async () => {
      let { vault } = await loadFixture(defaultFixture);
      await vault.rebase();
    });

    it("Should allow non-governor to call rebase", async () => {
      let { vault, anna } = await loadFixture(defaultFixture);
      await vault.connect(anna).rebase();
    });

    it("Should not rebase when rebasing is paused", async () => {
      let { vault, governor } = await loadFixture(defaultFixture);
      await vault.connect(governor).pauseRebase();
      await expect(vault.rebase()).to.be.revertedWith("Rebasing paused");
    });

    it("Should not allow non-governor to pause or unpause rebase", async () => {
      let { vault, anna } = await loadFixture(defaultFixture);
      await expect(vault.connect(anna).pauseRebase()).to.be.revertedWith(
        "Caller is not the Governor"
      );
      await expect(vault.connect(anna).unpauseRebase()).to.be.revertedWith(
        "Caller is not the Governor"
      );
    });

    it("Rebase pause status can be read", async () => {
      let { vault, anna } = await loadFixture(defaultFixture);
      await expect(await vault.connect(anna).rebasePaused()).to.be.false;
    });
  });

  describe("Rebasing", async () => {
    it("Should alter balances after an asset price change", async () => {
      let { ousd, vault, matt, oracle } = await loadFixture(defaultFixture);
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.rebase();
      await expect(matt).has.a.balanceOf("200.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should alter balances after an asset price change, single", async () => {
      let { ousd, vault, matt, oracle } = await loadFixture(defaultFixture);
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.rebase();
      await expect(matt).has.a.balanceOf("200.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should alter balances after an asset price change with multiple assets", async () => {
      let { ousd, vault, matt, oracle, usdc } = await loadFixture(
        defaultFixture
      );

      await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("200"));
      expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
      await expect(matt).has.a.balanceOf("300.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("300.00", ousd);

      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.rebase();
      expect(await ousd.totalSupply()).to.eq(ousdUnits("600.0"));
      await expect(matt).has.an.approxBalanceOf("450.00", ousd);

      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.rebase();
      expect(await ousd.totalSupply()).to.eq(
        ousdUnits("400.0"),
        "After assets go back"
      );
      await expect(matt).has.a.balanceOf("300.00", ousd);
    });

    /*
    it("Should increase users balance on rebase after increased Vault value", async () => {
      const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
      // Total OUSD supply is 200, mock an increase
      await vault.setTotalValue(utils.parseUnits("220", 18));
      await vault.rebase();
      await expect(matt).has.an.approxBalanceOf("110.00", ousd);
      await expect(josh).has.an.approxBalanceOf("110.00", ousd);
    });

    it("Should decrease users balance on rebase after decreased Vault value", async () => {
      const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
      // Total OUSD supply is 200, mock a decrease
      await vault.setTotalValue(utils.parseUnits("180", 18));
      await vault.rebase();
      await expect(matt).has.an.approxBalanceOf("90.00", ousd);
      await expect(josh).has.an.approxBalanceOf("90.00", ousd);
    });
    */

    it("Should alter balances after supported asset deposited and rebase called", async () => {
      let { ousd, vault, matt, usdc, josh } = await loadFixture(defaultFixture);
      await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
      await expect(matt).has.an.approxBalanceOf("100.00", ousd);
      await expect(josh).has.an.approxBalanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.an.approxBalanceOf(
        "200.00",
        ousd,
        "Matt has wrong balance"
      );
      await expect(josh).has.an.approxBalanceOf(
        "200.00",
        ousd,
        "Josh has wrong balance"
      );
    });
  });

  describe("Deposit pausing", async () => {
    let vault, usdc, governor, anna;

    beforeEach(async () => {
      const fixture = await loadFixture(defaultFixture);
      vault = fixture.vault;
      governor = fixture.governor;
      anna = fixture.anna;
      usdc = fixture.usdc;
    });

    it("Non-governor cannot pause", async () => {
      await expect(vault.connect(anna).pauseDeposits()).to.be.revertedWith(
        "Caller is not the Governor"
      );
    });

    it("Non-governor cannot unpause", async () => {
      await expect(vault.connect(anna).unpauseDeposits()).to.be.revertedWith(
        "Caller is not the Governor"
      );
    });

    it("Pausing deposits stops deposits", async () => {
      await vault.connect(governor).pauseDeposits();
      expect(await vault.connect(anna).depositPaused()).to.be.true;
      await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
      await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"))).to
        .be.reverted;
    });

    it("Unpausing deposits allows deposits", async () => {
      await vault.connect(governor).pauseDeposits();
      expect(await vault.connect(anna).depositPaused()).to.be.true;
      await vault.connect(governor).unpauseDeposits();
      expect(await vault.connect(anna).depositPaused()).to.be.false;
      await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    });

    it("Deposit pause status can be read", async () => {
      expect(await vault.connect(anna).depositPaused()).to.be.false;
    });
  });

  describe("Compound strategy", function () {
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
      const { matt, compoundStrategy } = await loadFixture(
        compoundVaultFixture
      );
      await compoundStrategy.connect(matt).safeApproveAllTokens();
    });

    it("Only Governor can call setPTokenAddress", async () => {
      const { dai, ousd, matt, compoundStrategy } = await loadFixture(
        compoundVaultFixture
      );
      await expect(
        compoundStrategy
          .connect(matt)
          .setPTokenAddress(ousd.address, dai.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Only Vault can call collectRewardToken", async () => {
      const { matt, compoundStrategy } = await loadFixture(
        compoundVaultFixture
      );
      await expect(
        compoundStrategy.connect(matt).collectRewardToken()
      ).to.be.revertedWith("Caller is not the Vault");
    });

    it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
      const { anna, oracle, ousd, usdc, vault } = await loadFixture(
        compoundVaultFixture
      );
      await expect(anna).has.a.balanceOf("0", ousd);
      // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
      await oracle.setPrice("USDC", oracleUnits("3.00"));
      await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("50"));
      await expect(anna).has.a.balanceOf("150", ousd);
    });

    it("Should allow withdrawals", async () => {
      const { anna, compoundStrategy, ousd, usdc, vault } = await loadFixture(
        compoundVaultFixture
      );
      await expect(anna).has.a.balanceOf("1000.00", usdc);
      await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
      await expect(anna).has.a.balanceOf("50.00", ousd);

      // Verify the deposit went to Compound
      expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
        usdcUnits("50.0")
      );

      // Note Anna will have slightly less than 50 due to deposit to Compound
      // according to the MockCToken implementation
      // TODO verify for mainnet
      await ousd.connect(anna).approve(vault.address, ousdUnits("40.0"));
      await vault.connect(anna).redeem(usdc.address, ousdUnits("40.0"));

      await expect(anna).has.a.balanceOf("10", ousd);
      await expect(anna).has.a.balanceOf("990", usdc);
    });

    it("Should calculate the balance correctly with DAI in strategy", async () => {
      const { dai, vault, josh, compoundStrategy } = await loadFixture(
        compoundVaultFixture
      );

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("200", 18)
      );

      // Josh deposits DAI, 18 decimals
      await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
      await vault.connect(josh).mint(dai.address, daiUnits("22.0"));

      // Josh had 1000 DAI but used 100 DAI to mint OUSD in the fixture
      await expect(josh).has.an.approxBalanceOf("878.0", dai, "Josh has less");

      // Verify the deposit went to Compound
      expect(await compoundStrategy.checkBalance(dai.address)).to.approxEqual(
        daiUnits("22.0")
      );

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("222", 18)
      );
    });

    it("Should calculate the balance correctly with USDC in strategy", async () => {
      const { usdc, vault, matt, compoundStrategy } = await loadFixture(
        compoundVaultFixture
      );

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("200", 18)
      );

      // Matt deposits USDC, 6 decimals
      await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));

      // Verify the deposit went to Compound
      await expect(matt).has.an.approxBalanceOf("992.0", usdc, "Matt has less");

      expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
        usdcUnits("8.0")
      );

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("208", 18)
      );
    });

    it(
      "Should calculate the balance correct with TUSD in Vault and DAI, USDC, TUSD in Compound strategy"
    );

    it("Should correctly rebase with changes in Compound exchange rates", async () => {
      const { vault, matt, dai } = await loadFixture(compoundVaultFixture);
      await expect(await vault.totalValue()).to.equal(
        utils.parseUnits("200", 18)
      );
      await dai.connect(matt).approve(vault.address, daiUnits("100"));
      await vault.connect(matt).mint(dai.address, daiUnits("100"));

      await expect(await vault.totalValue()).to.equal("TODO");
    });

    it("Should correctly liquidate all assets in Compound strategy", async () => {
      const {
        usdc,
        vault,
        matt,
        josh,
        dai,
        compoundStrategy,
        governor,
      } = await loadFixture(compoundVaultFixture);

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("200", 18)
      );

      // Matt deposits USDC, 6 decimals
      await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"));

      expect(await compoundStrategy.checkBalance(usdc.address)).to.approxEqual(
        usdcUnits("8.0")
      );
      await dai.connect(josh).approve(vault.address, daiUnits("22.0"));
      await vault.connect(josh).mint(dai.address, daiUnits("22.0"));

      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("230", 18)
      );

      await compoundStrategy.connect(governor).liquidate();
      // There should be no DAI or USDC left in compound strategy
      expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(0);
      expect(await compoundStrategy.checkBalance(dai.address)).to.equal(0);
      // Vault value should remain the same because the liquidattion sent the
      // assets back to the vault
      expect(await vault.totalValue()).to.approxEqual(
        utils.parseUnits("230", 18)
      );
    });
  });
});
