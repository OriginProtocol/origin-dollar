const {
  defaultFixture,
  mockVaultFixture,
  compoundVaultFixture,
} = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  oracleUnits,
  loadFixture,
} = require("../helpers");

describe("Vault rebase pausing", async () => {
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

describe("Vault rebasing", async () => {
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
    let { ousd, vault, matt, oracle, usdc } = await loadFixture(defaultFixture);

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

  it("Should not allocate unallocated assets when no Strategy configured", async () => {
    const { anna, governor, dai, usdc, usdt, tusd, vault } = await loadFixture(
      defaultFixture
    );

    await dai.connect(anna).transfer(vault.address, daiUnits("100"));
    await usdc.connect(anna).transfer(vault.address, usdcUnits("200"));
    await usdt.connect(anna).transfer(vault.address, usdtUnits("300"));
    await tusd.connect(anna).transfer(vault.address, tusdUnits("400"));

    await vault.connect(governor).allocate();

    // All assets sould still remain in Vault

    // Note defaultFixture sets up with 200 DAI already in the Strategy
    // 200 + 100 = 300
    await expect(await dai.balanceOf(vault.address)).to.equal(daiUnits("300"));
    await expect(await usdc.balanceOf(vault.address)).to.equal(
      usdcUnits("200")
    );
    await expect(await usdt.balanceOf(vault.address)).to.equal(
      usdtUnits("300")
    );
    await expect(await tusd.balanceOf(vault.address)).to.equal(
      tusdUnits("400")
    );
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
});
