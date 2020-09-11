const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");

const {
  ousdUnits,
  isGanacheFork,
  loadFixture,
  setOracleTokenPriceUsd,
  expectApproxSupply,
} = require("./helpers");

describe("Token", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should return the token name and symbol", async () => {
    const { ousd } = await loadFixture(defaultFixture);
    expect(await ousd.name()).to.equal("Origin Dollar");
    expect(await ousd.symbol()).to.equal("OUSD");
  });

  it("Should have 18 decimals", async () => {
    const { ousd } = await loadFixture(defaultFixture);
    expect(await ousd.decimals()).to.equal(18);
  });

  it("Should not allow anyone to mint OUSD directly", async () => {
    const { ousd, matt } = await loadFixture(defaultFixture);
    await expect(
      ousd.connect(matt).mint(matt.getAddress(), ousdUnits("100"))
    ).to.be.revertedWith("Caller is not the Vault");
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should allow a simple transfer of 1 OUSD", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", ousd);
    await expect(matt).has.a.balanceOf("100", ousd);
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expect(anna).has.a.balanceOf("1", ousd);
    await expect(matt).has.a.balanceOf("99", ousd);
  });

  it("Should allow a transferFrom with an allowance", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD for transferFrom
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("1000"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("1000"));

    // Do a transferFrom of OUSD
    await ousd
      .connect(anna)
      .transferFrom(
        await matt.getAddress(),
        await anna.getAddress(),
        ousdUnits("1")
      );

    // Anna should have the dollar
    await expect(anna).has.a.balanceOf("1", ousd);

    // Check if it has reflected in allowance
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("999"));
  });

  it("Should revert a transferFrom if an allowance is insufficient", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD for transferFrom
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("10"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("10"));

    // Do a transferFrom of OUSD
    await expect(
      ousd
        .connect(anna)
        .transferFrom(
          await matt.getAddress(),
          await anna.getAddress(),
          ousdUnits("100")
        )
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });

  it("Should allow to increase/decrease allowance", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("1000"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("1000"));

    // Decrease allowance
    await ousd
      .connect(matt)
      .decreaseAllowance(anna.getAddress(), ousdUnits("100"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("900"));

    // Increase allowance
    await ousd
      .connect(matt)
      .increaseAllowance(anna.getAddress(), ousdUnits("20"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("920"));
  });

  it("Should increase users balance on supply increase", async () => {
    const { ousd, vault, anna, matt } = await loadFixture(defaultFixture);
    // Transfer 1 to Anna, so we can check different amounts
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(anna).has.a.balanceOf("1", ousd);

    // Increase total supply thus increasing all user's balances
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/200) * 202 OUSD
    await expect(matt).has.a.balanceOf("99.99", ousd);
    // Anna should have (1/200) * 202 OUSD
    await expect(anna).has.a.balanceOf("1.01", ousd);
  });

  it("Should not change balance of non-rebasing account when rebasing", async () => {
    const { ousd, vault, matt } = await loadFixture(defaultFixture);
    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(vault.address, ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(await ousd.balanceOf(vault.address)).to.equal(ousdUnits("1"));

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/199) * (202-1) OUSD
    await expect(matt).has.an.approxBalanceOf("99.99", ousd);
    // Vault balance should remain unchanged
    await expect(vault).has.a.balanceOf("1", ousd);
  });

  describe("Correct balances when calling transfer from a non-rebasing to a non-rebasing account", async () => {
    let ousd, vault, matt, josh, fixed, fixture;
    expectBalances = async (expected) => {
      for (const k of Object.keys(expected)) {
        if (k == "supply") {
          await expectApproxSupply(ousd, ousdUnits(expected[k]), "supply");
        } else {
          await expect(fixture[k]).has.a.balanceOf(expected[k], ousd, k);
        }
      }
    };
    expectApproxBalances = async (expected) => {
      for (const k of Object.keys(expected)) {
        if (k == "supply") {
          await expectApproxSupply(ousd, ousdUnits(expected[k]), "supply");
        } else {
          await expect(fixture[k]).has.a.approxBalanceOf(expected[k], ousd, k);
        }
      }
    };
    before(async () => {
      fixture = await loadFixture(defaultFixture);
      fixture.fixed = fixture.mockNonRebasing; // alais for this test
      ousd = fixture.ousd;
      vault = fixture.vault;
      matt = fixture.matt;
      fixed = fixture.fixed;
      josh = fixture.josh;
    });
    it("Should allow transfer to a contract", async () => {
      await fixed.setOUSD(ousd.address);
      await ousd.connect(matt).transfer(fixed.address, ousdUnits("20"));
      await expectBalances({
        fixed: "20",
        matt: "80",
        josh: "100",
        supply: "200",
      });
    });
    it("Should not change amounts on rebase with no oracle changes", async () => {
      await vault.rebase();
      await expectBalances({
        fixed: "20",
        matt: "80",
        josh: "100",
        supply: "200",
      });
    });
    it("Should keep contract's amounts fixed on a rebase with oracle changes", async () => {
      await setOracleTokenPriceUsd("DAI", "1.10");
      await vault.rebase();
      await expectApproxBalances({
        fixed: "20",
        matt: "88.8889", //  (220 - 20) / 180 * 80
        josh: "111.1111", // (220 - 20) / 180 * 100
        supply: "220", // 111.111111111 + 88.888888889 + 20
      });
    });
    it("Should transfer from non-rebasing contract to non-rebasing contract", async () => {
      // Transfer 5 OUSD to Vault, both contracts now have different intternal
      // exchange rates
      await fixed.transfer(vault.address, ousdUnits("5"));
      await expectApproxBalances({
        fixed: "15",
        vault: "5",
        matt: "88.8889",
        josh: "111.1111",
        supply: "220",
      });
    });
    it("Should transfer from a non-rebasing contract to a rebasing contract", async () => {
      await fixed.transfer(await matt.getAddress(), ousdUnits("5"));
      await expectApproxBalances({
        fixed: "10",
        vault: "5",
        matt: "93.8889",
        josh: "111.1111",
        supply: "220",
      });
    });
    it("Should handle rebasing afeter transfer from contract to non-contract", async () => {
      await setOracleTokenPriceUsd("DAI", "1.0");
      await vault.rebase();
      await expectApproxBalances({
        fixed: "10",
        vault: "5",
        matt: "84.7290", // (200 - 10 - 5) * (93.8889 / (93.8889+111.1111))
        josh: "100.2710", // (200- 10 - 5) * (111.1111 / (93.8889+111.1111))
        supply: "200", // 10 + 5 + 84.7290 + 100.2710
      });
    });
  });

  it("Should have correct balances when calling transfer from a non-rebasing to a rebasing account", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    // Transfer 1 OUSD to mock contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("5"));
    await expect(matt).has.a.balanceOf("95", ousd);
    await expect(mockNonRebasing).has.a.balanceOf("5", ousd);

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (95/195) * (202-5) OUSD
    await expect(matt).has.an.approxBalanceOf("95.9743", ousd, "rebase");

    // Transfer out of the non-rebasing account to the normal account
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("5"));

    await expect(matt).has.an.approxBalanceOf("100.9743", ousd, "transfer");
    await expect(mockNonRebasing).has.a.balanceOf("0", ousd);

    // Do-nothing rebase
    await vault.rebase();

    await expect(matt).has.an.approxBalanceOf(
      "100.9743",
      ousd,
      "Matt has incorrect balance after transfer and rebase"
    );

    await expect(mockNonRebasing).has.a.balanceOf("0", ousd);
  });

  it(
    "Should have correct balances when calling transfer from a rebasing account to a non-rebasing account"
  );

  it(
    "Should have correct balances when calling transfer from a rebasing account to a rebasing account"
  );

  it(
    "Should have correct balances when calling transferFrom from a non-rebasing account to a non-rebasing account"
  );

  it(
    "Should have correct balances when calling transferFrom from a non-rebasing account to a rebasing account"
  );

  it("Should have correct balances when calling transferFrom from a rebasing account to a non-rebasing account", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await mockNonRebasing.setOUSD(ousd.address);

    // Transfer 5 OUSD to the contract
    await ousd
      .connect(matt)
      .increaseAllowance(mockNonRebasing.address, ousdUnits("5"));
    await mockNonRebasing.transferFrom(
      await matt.getAddress(),
      mockNonRebasing.address,
      ousdUnits("5")
    );
    // Contract should now have 5 OUSD
    await expect(mockNonRebasing).has.a.balanceOf("5", ousd);
    // Matt should have (95/195) * (200-5) OUSD
    // or just 95 OUSD since the contract took 5 from his 100 OUSD
    await expect(matt).has.a.balanceOf(
      "95",
      ousd,
      "Matt has incorrect balance"
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.02");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // 95/195 * (200 * 1.02 - 5)
    await expect(matt).has.an.approxBalanceOf(
      "96.9487",
      ousd,
      "Matt has incorrect balance after transfer and rebase"
    );
    // Contract should still have 5 OUSD
    await expect(mockNonRebasing).has.a.balanceOf("5", ousd);
  });

  it("Should have correct balances when calling transferFrom from a rebasing account to a rebasing account", async () => {
    const { ousd, vault, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await mockNonRebasing.setOUSD(ousd.address);

    await ousd
      .connect(matt)
      .increaseAllowance(mockNonRebasing.address, ousdUnits("18"));

    await mockNonRebasing.transferFrom(
      await matt.getAddress(),
      await josh.getAddress(),
      ousdUnits("18")
    );

    await expect(await ousd.balanceOf(await josh.getAddress())).to.equal(
      ousdUnits("118")
    );

    // Contract originally contained $200, now has $202.
    // Matt should have (90/190) * 202 OUSD
    await expect(matt).has.a.balanceOf(
      "82",
      ousd,
      "Matt has incorrect balance"
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.05");
    await vault.rebase();

    // 82/200 * (200 * 1.05)
    await expect(matt).has.an.approxBalanceOf(
      "86.1",
      ousd,
      "Matt has incorrect balance after transfer and rebase"
    );
  });

  it("Should allow a contract to opt into rebases", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(mockNonRebasing).has.a.balanceOf("1", ousd);

    // Unfreeze the account, i.e. expose it to rebasing
    await mockNonRebasing.rebaseOptIn();
    // Balance should remain the same
    await expect(mockNonRebasing).has.a.balanceOf("1", ousd, "before");

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Vault balance raise after the rebase
    await expect(mockNonRebasing).has.an.approxBalanceOf("1.01", ousd, "after");
    // Matt should have (99/200) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf("99.99", ousd, "matt after");
  });

  it("Should allow a contract to freeze and unfreeze", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);

    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("1"));

    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(mockNonRebasing).has.a.balanceOf("1", ousd);

    // Unfreeze the account, i.e. expose it to rebasing
    await mockNonRebasing.rebaseOptIn();
    // Freeze the account again
    await mockNonRebasing.rebaseOptOut();

    // Balance should remain the same
    await expect(mockNonRebasing).has.a.balanceOf("1", ousd);

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt and Josh share 202 - 1.01
    // Matt should have (99/199) * (202-1.0) OUSD
    await expect(matt).has.an.approxBalanceOf(
      "99.9949",
      ousd,
      "Matt has incorrect balance"
    );
    // Vault balance should remain unchanged
    await expect(mockNonRebasing).has.a.balanceOf("1", ousd);
  });

  it("Should not allow a contract to opt in if already opted in to rebasing", async () => {
    const { ousd, mockNonRebasing } = await loadFixture(defaultFixture);
    await mockNonRebasing.setOUSD(ousd.address);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing.rebaseOptIn()).to.be.revertedWith(
      "Account has already opted in"
    );
  });

  it("Should not allow a contract to opt out if not opted in to rebasing", async () => {
    const { ousd, mockNonRebasing } = await loadFixture(defaultFixture);
    await mockNonRebasing.setOUSD(ousd.address);
    await expect(mockNonRebasing.rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should not allow a non-contract address to opt in to rebasing", async () => {
    const { ousd, matt } = await loadFixture(defaultFixture);
    await expect(ousd.connect(matt).rebaseOptIn()).to.be.revertedWith(
      "Address is not a contract"
    );
  });

  it("Should not allow a non-contract address to opt out of rebasing", async () => {
    const { ousd, matt } = await loadFixture(defaultFixture);
    await expect(ousd.connect(matt).rebaseOptOut()).to.be.revertedWith(
      "Address is not a contract"
    );
  });
});
