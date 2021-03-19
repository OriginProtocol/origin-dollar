const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  getOracleAddress,
  setOracleTokenPriceUsd,
  expectApproxSupply,
  loadFixture,
} = require("../helpers");

describe("Vault rebase pausing", async () => {
  it("Should allow non-governor to call rebase", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await vault.connect(anna).rebase();
  });

  it("Should handle rebase pause flag correctly", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
    await expect(vault.rebase()).to.be.revertedWith("Rebasing paused");
    await vault.connect(governor).unpauseRebase();
    await vault.rebase();
  });

  it("Should not allow the public to pause or unpause rebasing", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseRebase()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow strategist to pause rebasing", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await vault.connect(josh).pauseRebase();
  });

  it("Should allow strategist to unpause rebasing", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await expect(vault.connect(josh).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor tonpause rebasing", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
  });

  it("Should allow governor to unpause rebasing", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).unpauseRebase();
  });

  it("Rebase pause status can be read", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(await vault.connect(anna).rebasePaused()).to.be.false;
  });
});

describe("Vault rebasing", async () => {
  it("Should not alter balances after an asset price change", async () => {
    let { ousd, vault, matt } = await loadFixture(defaultFixture);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await setOracleTokenPriceUsd("DAI", "1.30");

    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("100.00", ousd);
    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should not alter balances after an asset price change, single", async () => {
    let { ousd, vault, matt } = await loadFixture(defaultFixture);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await setOracleTokenPriceUsd("DAI", "1.30");
    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("100.00", ousd);
    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should not alter balances after an asset price change with multiple assets", async () => {
    let { ousd, vault, matt, usdc } = await loadFixture(defaultFixture);

    await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("200"), 0);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
    await expect(matt).has.a.balanceOf("300.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("300.00", ousd);

    await setOracleTokenPriceUsd("DAI", "1.30");
    await vault.rebase();
    expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
    await expect(matt).has.an.approxBalanceOf("300.00", ousd);

    await setOracleTokenPriceUsd("DAI", "1.00");
    await vault.rebase();
    expect(await ousd.totalSupply()).to.eq(
      ousdUnits("400.0"),
      "After assets go back"
    );
    await expect(matt).has.a.balanceOf("300.00", ousd);
  });

  it("Should alter balances after supported asset deposited and rebase called for rebasing accounts", async () => {
    let { ousd, vault, matt, usdc, josh } = await loadFixture(defaultFixture);
    // Transfer USDC into the Vault to simulate yield
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

  it("Should not alter balances after supported asset deposited and rebase called for non-rebasing accounts", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);

    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));

    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);

    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    await expect(matt).has.an.approxBalanceOf("300.00", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
  });

  it("Should not allocate unallocated assets when no Strategy configured", async () => {
    const { anna, governor, dai, usdc, usdt, tusd, vault } = await loadFixture(
      defaultFixture
    );

    await dai.connect(anna).transfer(vault.address, daiUnits("100"));
    await usdc.connect(anna).transfer(vault.address, usdcUnits("200"));
    await usdt.connect(anna).transfer(vault.address, usdtUnits("300"));
    await tusd.connect(anna).transfer(vault.address, tusdUnits("400"));

    await expect(await vault.getStrategyCount()).to.equal(0);
    await vault.connect(governor).allocate();

    // All assets should still remain in Vault

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
    const { anna, ousd, usdc, vault } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", ousd);
    // The price should be limited by the code to $1
    await setOracleTokenPriceUsd("USDC", "1.20");
    await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50"), 0);
    await expect(anna).has.a.balanceOf("50", ousd);
  });

  it("Should allow priceProvider to be changed", async function () {
    const { anna, governor, vault } = await loadFixture(defaultFixture);
    const oracle = await getOracleAddress(deployments);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
    const annaAddress = await anna.getAddress();
    await vault.connect(governor).setPriceProvider(annaAddress);
    await expect(await vault.priceProvider()).to.be.equal(annaAddress);

    // Only governor should be able to set it
    await expect(
      vault.connect(anna).setPriceProvider(oracle)
    ).to.be.revertedWith("Caller is not the Governor");

    await vault.connect(governor).setPriceProvider(oracle);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
  });
});

describe("Vault yield accrual to OGN", async () => {
  [
    { yield: "1000", basis: 100, expectedFee: "10" },
    { yield: "1000", basis: 5000, expectedFee: "500" },
    { yield: "1523", basis: 900, expectedFee: "137.07" },
    { yield: "0.000001", basis: 10, expectedFee: "0.00000001" },
    { yield: "0", basis: 1000, expectedFee: "0" },
  ].forEach((options) => {
    const { yield, basis, expectedFee } = options;
    it(`should collect on rebase a ${expectedFee} fee from ${yield} yield at ${basis}bp `, async function () {
      const fixture = await loadFixture(defaultFixture);
      const { matt, governor, ousd, usdt, vault, mockNonRebasing } = fixture;
      const trustee = mockNonRebasing;

      // Setup trustee trustee on vault
      await vault.connect(governor).setTrusteeAddress(trustee.address);
      await vault.connect(governor).setTrusteeFeeBps(900);
      await expect(trustee).has.a.balanceOf("0", ousd);

      // Create yield for the vault
      await usdt.connect(matt).mint(usdcUnits("1523"));
      await usdt.connect(matt).transfer(vault.address, usdcUnits("1523"));
      // Do rebase
      const supplyBefore = await ousd.totalSupply();
      await vault.rebase();
      // OUSD supply increases correctly
      await expectApproxSupply(ousd, supplyBefore.add(ousdUnits("1523")));
      // ogntrustee address increases correctly
      // 1523 * 0.09 = 137.07
      await expect(trustee).has.a.balanceOf("137.07", ousd);
    });
  });
});
