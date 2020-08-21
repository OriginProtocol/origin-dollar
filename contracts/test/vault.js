const { expect } = require("chai");
const { utils } = require("ethers");

const { defaultFixture } = require("./_fixture");
const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  oracleUnits,
  expectBalance,
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
    const { ousd, usdc, dai, matt } = await loadFixture(defaultFixture);

    await expectBalance(ousd, matt, ousdUnits("100.0"), "Initial");

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(ousd.address, usdcUnits("2.0"));
    await ousd.connect(matt).mint(usdc.address, usdcUnits("2.0"));
    await expectBalance(ousd, matt, ousdUnits("102.0"));

    // Matt deposits DAI, 18 decimals
    await dai.connect(matt).approve(ousd.address, daiUnits("4.0"));
    await ousd.connect(matt).mint(dai.address, daiUnits("4.0"));
    await expectBalance(ousd, matt, ousdUnits("106.0"));
  });

  it("Should correctly handle a deposit of DAI (18 decimals)", async function () {
    const { ousd, dai, anna, oracle } = await loadFixture(defaultFixture);
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 3 DAI worth $2 each, she should have $6 OUSD.
    await oracle.setPrice("DAI", oracleUnits("2.00"));
    await dai.connect(anna).approve(ousd.address, daiUnits("3.0"));
    await ousd.connect(anna).mint(dai.address, daiUnits("3.0"));
    await expectBalance(ousd, anna, ousdUnits("6.0"));
  });

  it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
    const { ousd, usdc, anna, oracle } = await loadFixture(defaultFixture);
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDC", oracleUnits("3.00"));
    await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
    await ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("150.0"));
  });

  it("Should allow withdrawals", async () => {
    const { ousd, usdc, anna } = await loadFixture(defaultFixture);
    await expectBalance(usdc, anna, usdcUnits("1000.0"), "Initial balance");
    await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
    await ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("50.0"));
    await ousd.connect(anna).approve(ousd.address, ousdUnits("50.0"));
    await ousd.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("0.0"), "Should remove OUSD");
    await expectBalance(usdc, anna, ousdUnits("1000.0"), "Should return USDC");
  });

  it("Should calculate the balance correctly with DAI", async () => {
    const { vault } = await loadFixture(defaultFixture);
    // Vault already has DAI from default ficture
    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("200", 18)
    );
  });

  it("Should calculate the balance correctly with USDC", async () => {
    const { ousd, usdc, matt, vault } = await loadFixture(defaultFixture);

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(ousd.address, usdcUnits("2.0"));
    await ousd.connect(matt).mint(usdc.address, usdcUnits("2.0"));
    // Fixture loads 200 DAI, so result should be 202
    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("202", 18)
    );
  });

  it("Should calculate the balance correctly with USDT", async () => {
    const { vault, usdt, matt, ousd } = await loadFixture(defaultFixture);

    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(ousd.address, usdtUnits("5.0"));
    await ousd.connect(matt).mint(usdt.address, usdtUnits("5.0"));
    // Fixture loads 200 DAI, so result should be 205
    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("205", 18)
    );
  });

  it("Should calculate the balance correctly with TUSD", async () => {
    const { vault, tusd, matt, ousd } = await loadFixture(defaultFixture);

    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(ousd.address, tusdUnits("9.0"));
    await ousd.connect(matt).mint(tusd.address, tusdUnits("9.0"));
    // Fixture loads 200 DAI, so result should be 209
    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("209", 18)
    );
  });

  it("Should calculate the balance correctly with DAI, USDC, USDT, TUSD", async () => {
    const { vault, usdc, usdt, tusd, matt, ousd } = await loadFixture(
      defaultFixture
    );

    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(ousd.address, usdcUnits("8.0"));
    await ousd.connect(matt).mint(usdc.address, usdcUnits("8.0"));
    // Matt deposits USDT, 6 decimals
    await usdt.connect(matt).approve(ousd.address, usdtUnits("20.0"));
    await ousd.connect(matt).mint(usdt.address, usdtUnits("20.0"));
    // Matt deposits TUSD, 18 decimals
    await tusd.connect(matt).approve(ousd.address, tusdUnits("9.0"));
    await ousd.connect(matt).mint(tusd.address, tusdUnits("9.0"));
    // Fixture loads 200 DAI, so result should be 237
    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("237", 18)
    );
  });

  it("Should only allow governor to call rebase");

  it("Should not rebase when rebasing is paused", async () => {
    let { vault } = await loadFixture(defaultFixture);
    const { governorAddr } = await getNamedAccounts();
    const vaultContractGovernor = vault.connect(
      ethers.provider.getSigner(governorAddr)
    );
    await vaultContractGovernor.setRebasePaused(true);
    await expect(await vaultContractGovernor.rebase()).to.be.revertedWith(
      "Rebasing paused"
    );
  });

  it("Should rebase when rebasing is not paused");

  describe("Vault deposit pausing", async () => {
    let ousd, vault, usdc, governor, anna;
    beforeEach(async () => {
      const fixture = await loadFixture(defaultFixture);
      ousd = fixture.ousd;
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
      await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
      await expect(ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"))).to
        .be.reverted;
    });
    it("Unpausing deposits allows deposits", async () => {
      await vault.connect(governor).pauseDeposits();
      expect(await vault.connect(anna).depositPaused()).to.be.true;
      await vault.connect(governor).unpauseDeposits();
      expect(await vault.connect(anna).depositPaused()).to.be.false;
      await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
      await ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"));
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

  let matt, anna;
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
    const { governorAddr } = await getNamedAccounts();
    const vaultContractGovernor = vault.connect(
      ethers.provider.getSigner(governorAddr)
    );
    vaultContractGovernor.addStrategy(compoundStrategy.address, 100);
  });

  it("Should deposit supported assets into Compound and mint corresponding cToken", async () => {
    // Mint OUSD
    await dai.connect(matt).approve(ousd.address, daiUnits("100"));
    await ousd.connect(matt).mint(dai.address, daiUnits("100"));

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
    await expectBalance(ousd, anna, ousdUnits("0.0"));
    // If Anna deposits 50 USDC worth $3 each, she should have $150 OUSD.
    await oracle.setPrice("USDC", oracleUnits("3.00"));
    await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
    await ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("150.0"));
  });

  it("Should allow withdrawals", async () => {
    const { ousd, usdc, anna } = await loadFixture(defaultFixture);
    await expectBalance(usdc, anna, usdcUnits("1000.0"), "Initial balance");
    await usdc.connect(anna).approve(ousd.address, usdcUnits("50.0"));
    await ousd.connect(anna).mint(usdc.address, usdcUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("50.0"));
    await ousd.connect(anna).approve(ousd.address, ousdUnits("50.0"));
    await ousd.connect(anna).redeem(usdc.address, ousdUnits("50.0"));
    await expectBalance(ousd, anna, ousdUnits("0.0"), "Should remove OUSD");
    await expectBalance(usdc, anna, ousdUnits("1000.0"), "Should return USDC");
  });

  it("Should calculate the balance correctly with DAI");

  it("Should calculate the balance correctly with USDC in strategy", async () => {
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(ousd.address, usdcUnits("8.0"));
    await ousd.connect(matt).mint(usdc.address, usdcUnits("8.0"));

    // Verify the deposit went to Compound
    await expect(await compoundStrategy.checkBalance(usdc.address)).to.equal(
      usdcUnits("8.0")
    );

    await expect(await vault.callStatic.checkBalance()).to.equal(
      utils.parseUnits("208", 18)
    );
  });

  it(
    "Should calculate the balance correct with DAI, USDC, USDT, TUSD and DAI, USDC in Compound strategy"
  );
});
