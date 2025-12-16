const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const {
  ousdUnits,
  usdcUnits,
  getOracleAddress,
  setOracleTokenPriceUsd,
  expectApproxSupply,
} = require("../helpers");

describe("Vault rebase", () => {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("Vault rebase pausing", async () => {
    it("Should allow non-governor to call rebase", async () => {
      const { vault, anna } = fixture;
      await vault.connect(anna).rebase();
    });

    it("Should handle rebase pause flag correctly", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).pauseRebase();
      await expect(vault.rebase()).to.be.revertedWith("Rebasing paused");
      await vault.connect(governor).unpauseRebase();
      await vault.rebase();
    });

    it("Should not allow the public to pause or unpause rebasing", async () => {
      const { vault, anna } = fixture;

      await expect(vault.connect(anna).pauseRebase()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
      await expect(vault.connect(anna).unpauseRebase()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });

    it("Should allow strategist to pause rebasing", async () => {
      const { vault, governor, josh } = fixture;
      await vault.connect(governor).setStrategistAddr(josh.address);
      await vault.connect(josh).pauseRebase();
    });

    it("Should allow strategist to unpause rebasing", async () => {
      const { vault, governor, josh } = fixture;
      await vault.connect(governor).setStrategistAddr(josh.address);
      await vault.connect(josh).unpauseRebase();
    });

    it("Should allow governor to pause rebasing", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).pauseRebase();
    });

    it("Should allow governor to unpause rebasing", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).unpauseRebase();
    });

    it("Rebase pause status can be read", async () => {
      const { vault, anna } = fixture;
      await expect(await vault.connect(anna).rebasePaused()).to.be.false;
    });
  });

  describe("Vault rebasing", async () => {
    it("Should not alter balances after an asset price change", async () => {
      const { ousd, vault, matt } = fixture;

      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await setOracleTokenPriceUsd("USDS", "1.30");

      await vault.rebase();
      await expect(matt).has.a.approxBalanceOf("100.00", ousd);
      await setOracleTokenPriceUsd("USDS", "1.00");
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should not alter balances after an asset price change, single", async () => {
      const { ousd, vault, matt } = fixture;

      await expect(matt).has.a.balanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
      await setOracleTokenPriceUsd("USDS", "1.30");
      await vault.rebase();
      await expect(matt).has.a.approxBalanceOf("100.00", ousd);
      await setOracleTokenPriceUsd("USDS", "1.00");
      await vault.rebase();
      await expect(matt).has.a.balanceOf("100.00", ousd);
    });

    it("Should not alter balances after an asset price change with multiple assets", async () => {
      const { ousd, vault, matt, usdc } = fixture;

      await usdc.connect(matt).approve(vault.address, usdcUnits("200"));
      await vault.connect(matt).mint(usdc.address, usdcUnits("200"), 0);
      expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
      await expect(matt).has.a.balanceOf("300.00", ousd);
      await vault.rebase();
      await expect(matt).has.a.balanceOf("300.00", ousd);

      await setOracleTokenPriceUsd("USDS", "1.30");
      await vault.rebase();
      expect(await ousd.totalSupply()).to.eq(ousdUnits("400.0"));
      await expect(matt).has.an.approxBalanceOf("300.00", ousd);

      await setOracleTokenPriceUsd("USDS", "1.00");
      await vault.rebase();
      expect(await ousd.totalSupply()).to.eq(
        ousdUnits("400.0"),
        "After assets go back"
      );
      await expect(matt).has.a.balanceOf("300.00", ousd);
    });

    it("Should alter balances after supported asset deposited and rebase called for rebasing accounts", async () => {
      const { ousd, vault, matt, usdc, josh } = fixture;

      // Transfer USDC into the Vault to simulate yield
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await expect(matt).has.an.approxBalanceOf("100.00", ousd);
      await expect(josh).has.an.approxBalanceOf("100.00", ousd);
      await vault.rebase();
      await expect(matt).has.an.approxBalanceOf(
        "101.00",
        ousd,
        "Matt has wrong balance"
      );
      await expect(josh).has.an.approxBalanceOf(
        "101.00",
        ousd,
        "Josh has wrong balance"
      );
    });

    it("Should not alter balances after supported asset deposited and rebase called for non-rebasing accounts", async () => {
      const { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

      await expect(matt).has.an.approxBalanceOf("100.00", ousd);
      await expect(josh).has.an.approxBalanceOf("100.00", ousd);

      // Give contract 100 OUSD from Josh, making it non-rebasing
      await ousd
        .connect(josh)
        .transfer(mockNonRebasing.address, ousdUnits("100"));

      await expect(matt).has.an.approxBalanceOf("100.00", ousd);
      await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);

      // Transfer USDC into the Vault to simulate yield
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.rebase();

      // The remaining rebasing account should get all the yield
      await expect(matt).has.an.approxBalanceOf("102.00", ousd);
      await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    });

    it("Should not allocate unallocated assets when no Strategy configured", async () => {
      const { anna, governor, usdc, vault } = fixture;

      await usdc.connect(anna).transfer(vault.address, usdcUnits("100"));

      expect(await vault.getStrategyCount()).to.equal(0);
      await vault.connect(governor).allocate();

      // Note defaultFixture sets up with 200 USDC already in the Strategy
      // 200 + 100 = 300
      expect(await usdc.balanceOf(vault.address)).to.equal(usdcUnits("300"));
    });

    it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
      const { anna, ousd, usdc, vault } = fixture;

      await expect(anna).has.a.balanceOf("0", ousd);
      // The price should be limited by the code to $1
      await setOracleTokenPriceUsd("USDC", "1.20");
      await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("50"), 0);
      await expect(anna).has.a.balanceOf("50", ousd);
    });

    it("Should allow priceProvider to be changed", async function () {
      const { anna, governor, vault } = fixture;

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
      { _yield: "1", basis: 100, expectedFee: "0.01" },
      { _yield: "1", basis: 5000, expectedFee: "0.5" },
      { _yield: "1.523", basis: 900, expectedFee: "0.13707" },
      { _yield: "0.000001", basis: 10, expectedFee: "0.000000001" },
      { _yield: "0", basis: 1000, expectedFee: "0" },
    ].forEach((options) => {
      const { _yield, basis, expectedFee } = options;

      it(`should collect on rebase a ${expectedFee} fee from ${_yield} yield at ${basis}bp `, async function () {
        const { matt, governor, ousd, usdc, vault, mockNonRebasing } = fixture;
        const trustee = mockNonRebasing;

        // Setup trustee on vault
        await vault.connect(governor).setTrusteeAddress(trustee.address);
        await vault.connect(governor).setTrusteeFeeBps(basis);
        await expect(trustee).has.a.balanceOf("0", ousd);

        // Create yield for the vault
        await usdc.connect(matt).mint(usdcUnits(_yield));
        await usdc.connect(matt).transfer(vault.address, usdcUnits(_yield));
        // Do rebase
        const supplyBefore = await ousd.totalSupply();
        await vault.rebase();
        // OUSD supply increases correctly
        await expectApproxSupply(ousd, supplyBefore.add(ousdUnits(_yield)));
        // ogntrustee address increases correctly
        await expect(trustee).has.a.balanceOf(expectedFee, ousd);
      });
    });
  });
});
