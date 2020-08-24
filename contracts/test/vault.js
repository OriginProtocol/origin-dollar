const { defaultFixture, mockVaultFixture } = require("./_fixture");
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
  it("Should support an asset");

  it("Should error when adding an asset that is already supported", async function () {
    const { vault, usdt } = await loadFixture(defaultFixture);
    await expect(vault.supportAsset(usdt.address)).to.be.reverted;
  });

  it("Should deprecate an asset");

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

  describe("Vault rebasing", async () => {
    it("Should rebase when rebasing is not paused", async () => {
      let { vault, governor } = await loadFixture(defaultFixture);
      await vault.connect(governor).rebase();
    });

    it("Should allow non-governor to call rebase", async () => {
      let { vault, anna } = await loadFixture(defaultFixture);
      vault.connect(anna).rebase();
    });

    it("Should not rebase when rebasing is paused", async () => {
      let { vault, governor } = await loadFixture(defaultFixture);
      await vault.connect(governor).setRebasePaused(true);
      await expect(vault.connect(governor).rebase()).to.be.revertedWith(
        "Rebasing paused"
      );
    });

    it("Should alter balances after an asset price change", async () => {
      let { ousd, vault, matt, oracle, governor } = await loadFixture(
        defaultFixture
      );
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("200.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should alter balances after an asset price change, single", async () => {
      let { ousd, vault, matt, oracle, governor } = await loadFixture(
        defaultFixture
      );
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("200.00", ousd);
      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should alter balances after an asset price change", async () => {
      let { ousd, vault, matt, oracle, governor, usdc } = await loadFixture(
        defaultFixture
      );

      await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("200"));
      expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
      await expect(matt).has.a.balanceOf("300.00", ousd);
      await vault.connect(governor).rebase();
      await expect(matt).has.a.balanceOf("300.00", ousd);

      await oracle.setPrice("DAI", oracleUnits("2.00"));
      await vault.connect(governor).rebase();
      expect(await ousd.totalSupply()).to.eq(ousdUnits("600.0"));
      await expect(matt).has.an.approxBalanceOf("450.00", ousd);

      await oracle.setPrice("DAI", oracleUnits("1.00"));
      await vault.connect(governor).rebase();
      expect(await ousd.totalSupply()).to.eq(
        ousdUnits("400.0"),
        "After assets go back"
      );
      await expect(matt).has.a.balanceOf("300.00", ousd);
    });
  });

  describe("Vault deposit pausing", async () => {
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
});

describe("Vault with Compound strategy", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  let matt, anna, governor;
  let ousd, usdc, dai, oracle, vault;
  let compoundStrategy;

  beforeEach(async () => {
    ({
      matt,
      anna,
      governor,
      ousd,
      usdc,
      dai,
      oracle,
      vault,
    } = await loadFixture(defaultFixture));
    // Add compound as the single strategy on the Vault contract with 100 weight
    compoundStrategy = await ethers.getContract("CompoundStrategy");
    vault.connect(governor).addStrategy(compoundStrategy.address, 100);
  });

  it("Should deposit supported assets into Compound and mint corresponding cToken", async () => {
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

  it("Should withdraw previously deposited assets");

  it(
    "Should correctly calculate the balance of the vault when assets are deposited"
  );

  it(
    "Should correctly calculate the balance of the vault when assets are withdrawn"
  );

  it("Should claim COMP tokens");

  it("Only Governor can call safeApproveAllTokens", async () => {
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).safeApproveAllTokens()
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Governor can call setPTokenAddress", async () => {
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).setPTokenAddress(ousd.address, dai.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const compoundStrategy = await ethers.getContract("CompoundStrategy");
    await expect(
      compoundStrategy.connect(matt).collectRewardToken(await matt.getAddress())
    ).to.be.revertedWith("Caller is not the Vault");
  });

  it("Should calculate the balance correctly with DAI in strategy");

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    await expect(anna).has.a.balanceOf("0", ousd);
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDC", oracleUnits("3.00"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50"));
    await expect(anna).has.a.balanceOf("150", ousd);
  });

  it("Should allow withdrawals", async () => {
    const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await ousd.connect(anna).approve(vault.address, ousdUnits("50.0"));
    await vault.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expect(anna).has.a.balanceOf("0", ousd, "Should remove OUSD");
    await expect(anna).has.a.balanceOf("1000", ousd, "Should return USDC");
  });

  it("Should calculate the balance correctly with DAI");

  it("Should calculate the balance correctly with USDC in strategy", async () => {
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
    "Should calculate the balance correct with DAI, USDC, USDT, TUSD and DAI, USDC in Compound strategy"
  );

  it("Should correctly rebase with changes in Compound exchange rates", async () => {
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
    await dai.connect(matt).approve(vault.address, daiUnits("100"));
    await vault.connect(matt).mint(dai.address, daiUnits("100"));

    await expect(await vault.totalValue()).to.equal("TODO");
  });
});

describe("Vault rebasing", function () {
  let vault, matt, ousd;

  beforeEach(async () => {
    ({ vault, matt, ousd } = await loadFixture(mockVaultFixture));
  });

  it("Should not change other users balance on deposit");

  it("Should not change other users balance on withdraw");

  it("Should increase users balance on rebase after increased value", async () => {
    // Total OUSD supply is 200, mock an increase
    await vault.setTotalValue(220);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("110.00", ousd);
  });
});
