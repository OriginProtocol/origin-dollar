const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const {
  ousdUnits,
  usdcUnits,
  expectApproxSupply,
  advanceTime,
} = require("../helpers");

describe("Vault rebase", () => {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("Vault rebase pausing", async () => {
    it("Should allow any account to call rebase when not throttled", async () => {
      const { vault, anna } = fixture;
      // minRebaseInterval defaults to 0, so anna can rebase.
      await vault.connect(anna).rebase();
    });

    it("Should handle rebase pause flag correctly", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).pauseRebase();
      await expect(vault.connect(governor).rebase()).to.be.revertedWith(
        "Rebasing paused"
      );
      await vault.connect(governor).unpauseRebase();
      await vault.connect(governor).rebase();
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

  describe("Vault rebase permissioning (operator)", async () => {
    it("Should allow the operator to call rebase", async () => {
      const { vault, governor, josh, matt, usdc, ousd } = fixture;
      await vault.connect(governor).setOperatorAddr(josh.address);

      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));

      const supplyBefore = await ousd.totalSupply();
      const tx = await vault.connect(josh).rebase();
      const receipt = await tx.wait();
      const hadYield = receipt.events.some(
        (e) => e.event === "YieldDistribution"
      );
      expect(hadYield).to.be.true;
      expect(await ousd.totalSupply()).to.be.gt(supplyBefore);
    });

    it("Should allow the strategist to call rebase", async () => {
      const { vault, governor, josh } = fixture;
      await vault.connect(governor).setStrategistAddr(josh.address);
      await vault.connect(josh).rebase();
    });

    it("Should allow the governor to call rebase", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).rebase();
    });

    it("Should let governor change the operator", async () => {
      const { vault, governor, josh } = fixture;
      await vault.connect(governor).setOperatorAddr(josh.address);
      expect(await vault.operatorAddr()).to.equal(josh.address);
    });

    it("Should not let non-governor set the operator", async () => {
      const { vault, anna } = fixture;
      await expect(
        vault.connect(anna).setOperatorAddr(anna.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Vault rebase throttle", async () => {
    it("Should silently no-op when a public caller calls within the throttle window", async () => {
      const { vault, governor, anna, matt, usdc, ousd } = fixture;
      await vault.connect(governor).setMinRebaseInterval(86400);

      // Authorized caller seeds lastRebaseTime.
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.connect(governor).rebase();
      const lastRebaseTimeBefore = await vault.lastRebaseTime();
      const supplyBefore = await ousd.totalSupply();

      // Add more yield. Public caller hits the throttle and silently no-ops.
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      const tx = await vault.connect(anna).rebase();
      const receipt = await tx.wait();
      const yieldEvents = receipt.events.filter(
        (e) => e.event === "YieldDistribution"
      );
      expect(yieldEvents.length).to.equal(0);
      expect(await vault.lastRebaseTime()).to.equal(lastRebaseTimeBefore);
      expect(await ousd.totalSupply()).to.equal(supplyBefore);
    });

    it("Should let authorized callers bypass the throttle", async () => {
      const { vault, governor, josh, matt, usdc, ousd } = fixture;
      await vault.connect(governor).setMinRebaseInterval(86400);
      await vault.connect(governor).setOperatorAddr(josh.address);

      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.connect(josh).rebase(); // Operator: first rebase.
      const lastRebaseTimeFirst = await vault.lastRebaseTime();

      // Add more yield and rebase again immediately as the operator. The
      // throttle bypass means the second rebase fires.
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      const supplyBefore = await ousd.totalSupply();
      await vault.connect(josh).rebase();
      expect(await vault.lastRebaseTime()).to.be.gt(lastRebaseTimeFirst);
      expect(await ousd.totalSupply()).to.be.gt(supplyBefore);
    });

    it("Should let a public caller rebase again after the throttle window elapses", async () => {
      const { vault, governor, anna, matt, usdc, ousd } = fixture;
      await vault.connect(governor).setMinRebaseInterval(60);

      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.connect(governor).rebase();
      const supplyAfterFirst = await ousd.totalSupply();

      await advanceTime(120);

      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      const tx = await vault.connect(anna).rebase();
      const receipt = await tx.wait();
      const yieldEvents = receipt.events.filter(
        (e) => e.event === "YieldDistribution"
      );
      expect(yieldEvents.length).to.equal(1);
      expect(await ousd.totalSupply()).to.be.gt(supplyAfterFirst);
    });

    it("Should not throttle anyone when minRebaseInterval is 0", async () => {
      const { vault, anna, matt, usdc } = fixture;
      // Default minRebaseInterval is 0 — both rebases (one public) should fire.
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.connect(anna).rebase();
      const lastRebaseTimeFirst = await vault.lastRebaseTime();

      await advanceTime(1);
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await vault.connect(anna).rebase();
      const lastRebaseTimeSecond = await vault.lastRebaseTime();

      expect(lastRebaseTimeSecond).to.be.gt(lastRebaseTimeFirst);
    });

    it("Should let governor or strategist set the interval", async () => {
      const { vault, governor, matt } = fixture;
      await vault.connect(governor).setMinRebaseInterval(3600);
      expect(await vault.minRebaseInterval()).to.equal(3600);

      // Strategist (matt) can also set it.
      await vault.connect(governor).setStrategistAddr(matt.address);
      await vault.connect(matt).setMinRebaseInterval(120);
      expect(await vault.minRebaseInterval()).to.equal(120);
    });

    it("Should reject an interval longer than 1 day", async () => {
      const { vault, governor } = fixture;
      await expect(
        vault.connect(governor).setMinRebaseInterval(86401)
      ).to.be.revertedWith("Interval too long");
    });

    it("Should reject setMinRebaseInterval from a random caller", async () => {
      const { vault, anna } = fixture;
      await expect(
        vault.connect(anna).setMinRebaseInterval(60)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    it("Should silently skip the rebase that would otherwise fire on a large public mint within the throttle window", async () => {
      const { vault, governor, anna, ousd, usdc } = fixture;
      await vault.connect(governor).setMinRebaseInterval(86400);

      // Seed lastRebaseTime.
      await vault.connect(governor).rebase();

      // Add yield. Public mint > rebaseThreshold should NOT trigger _rebase
      // because the public mint path is throttled.
      await usdc.connect(anna).transfer(vault.address, usdcUnits("2"));
      const lastRebaseTimeBefore = await vault.lastRebaseTime();
      const annaOusdBefore = await ousd.balanceOf(anna.address);

      const mintAmount = usdcUnits("1500");
      await usdc.connect(anna).mint(mintAmount);
      await usdc.connect(anna).approve(vault.address, mintAmount);
      const tx = await vault.connect(anna).mint(mintAmount);
      const receipt = await tx.wait();
      const yieldEvents = receipt.events.filter(
        (e) => e.event === "YieldDistribution"
      );
      expect(yieldEvents.length).to.equal(0);
      expect(await vault.lastRebaseTime()).to.equal(lastRebaseTimeBefore);
      expect(await ousd.balanceOf(anna.address)).to.be.gt(annaOusdBefore);
    });
  });

  describe("Vault rebasing", async () => {
    it("Should alter balances after supported asset deposited and rebase called for rebasing accounts", async () => {
      const { ousd, vault, matt, usdc, josh, governor } = fixture;

      // Transfer USDC into the Vault to simulate yield
      await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
      await expect(matt).has.an.approxBalanceOf("100.00", ousd);
      await expect(josh).has.an.approxBalanceOf("100.00", ousd);
      await vault.connect(governor).rebase();
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
      const { ousd, vault, matt, usdc, josh, mockNonRebasing, governor } =
        fixture;

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
      await vault.connect(governor).rebase();

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
      await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
      await vault.connect(anna).mint(usdcUnits("50"));
      await expect(anna).has.a.balanceOf("50", ousd);
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
        await vault.connect(governor).rebase();
        // OUSD supply increases correctly
        await expectApproxSupply(ousd, supplyBefore.add(ousdUnits(_yield)));
        // ogntrustee address increases correctly
        await expect(trustee).has.a.balanceOf(expectedFee, ousd);
      });
    });
  });
});
