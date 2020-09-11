const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");

const {
  ousdUnits,
  isGanacheFork,
  loadFixture,
  setOracleTokenPriceUsd,
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
    // Matt should have (99/199) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf("100.49", ousd);
    // Vault balance should remain unchanged
    await expect(await ousd.balanceOf(vault.address)).to.equal(ousdUnits("1"));
  });

  it("Should have correct balances when calling transfer from a non-rebasing to a non-rebasing account", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("10"));
    await expect(matt).has.a.balanceOf("90", ousd);

    // Transfer 10 OUSD to MockNonRebasing
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("10")
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Transfer 5 OUSD to Vault, both contracts now have different intternal
    // exchange rates
    await mockNonRebasing.transfer(vault.address, ousdUnits("5"));

    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("5")
    );

    await expect(await ousd.balanceOf(vault.address)).to.equal(ousdUnits("5"));

    // Contract originally contained $200, now has $202.
    // Matt should have (90/190) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "95.68",
      ousd,
      "Matt has incorrect balance"
    );

    // Transfer 5 OUSD back to Matt
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("5"));

    // Matt has (90/190) * 202 + 5 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "100.68",
      ousd,
      "Matt has incorrect balance after transfer back"
    );

    // Rebase here should change nothing
    await vault.rebase();

    // Matt has (90/190) * 202 + 5 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "100.68",
      ousd,
      "Matt has incorrect balance after transfer back"
    );

    // DAI falls back to 1.00
    await setOracleTokenPriceUsd("DAI", "1.0");
    await vault.rebase();

    // Matt should have 95/195 * $200
    await expect(matt).has.a.balanceOf(
      "97.43",
      ousd,
      "Matt has incorrect balance after transfer back and rebase"
    );
  });

  it("Should have correct balances when calling transfer from a non-rebasing to a rebasing account", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    // Transfer 1 OUSD to mock contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("5"));
    await expect(matt).has.a.balanceOf("95", ousd);
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("5")
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (95/195) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "98.410",
      ousd,
      "Matt has incorrect balance"
    );

    // Transfer out of the non-rebasing account to the non non-rebasing account
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("5"));

    await expect(matt).has.an.approxBalanceOf(
      "103.410",
      ousd,
      "Matt has incorrect balance after transfer"
    );

    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("0")
    );

    await vault.rebase();

    await expect(matt).has.an.approxBalanceOf(
      "103.410",
      ousd,
      "Matt has incorrect balance after transfer and rebase"
    );

    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("0")
    );
  });

  it("Should have correct balances when calling transfer from a rebasing account to a non-rebasing account", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await mockNonRebasing.setOUSD(ousd.address);

    await ousd
      .connect(matt)
      .increaseAllowance(mockNonRebasing.address, ousdUnits("5"));

    await mockNonRebasing.transferFrom(
      await matt.getAddress(),
      mockNonRebasing.address,
      ousdUnits("5")
    );

    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("5")
    );

    // Contract originally contained $200, now has $202.
    // Matt should have (90/190) * 202 OUSD
    await expect(matt).has.a.balanceOf(
      "95",
      ousd,
      "Matt has incorrect balance"
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.02");
    await vault.rebase();

    // 95/195 * (200 * 1.02)
    await expect(matt).has.an.approxBalanceOf(
      "99.38",
      ousd,
      "Matt has incorrect balance after transfer and rebase"
    );
  });

  it("Should have correct balances when calling transfer from a rebasing account to a rebasing account", async () => {
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

  it(
    "Should have correct balances when calling transferFrom from a non-rebasing account to a non-rebasing account"
  );

  it(
    "Should have correct balances when calling transferFrom from a non-rebasing account to a rebasing account"
  );

  it(
    "Should have correct balances when calling transferFrom from a rebasing account to a non-rebasing account"
  );

  it("Should allow a contract to opt out of rebases", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1")
    );

    // Unfreeze the account, i.e. expose it to rebasing
    await mockNonRebasing.rebaseOptIn();
    // Balance should remain the same
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1"),
      "MockNonRebasing has incorrect balance before rebase"
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/199) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "99.99",
      ousd,
      "Matt has incorrect balance"
    );
    // Vault balance should remain unchanged
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1.01"),
      "MockNonRebasing has incorrect balance after rebase"
    );
  });

  it("Should allow a contract to opt back in to rebases", async () => {
    const { ousd, vault, matt, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    await mockNonRebasing.setOUSD(ousd.address);
    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1")
    );

    // Unfreeze the account, i.e. expose it to rebasing
    await mockNonRebasing.rebaseOptIn();
    // Freeze the account again
    await mockNonRebasing.rebaseOptOut();
    // Balance should remain the same
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1"),
      "MockNonRebasing has incorrect balance before rebase"
    );

    // Increase total supply thus increasing Matt's balance
    await setOracleTokenPriceUsd("DAI", "1.01");
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/199) * 202 OUSD
    await expect(matt).has.an.approxBalanceOf(
      "100.49",
      ousd,
      "Matt has incorrect balance"
    );
    // Vault balance should remain unchanged
    await expect(await ousd.balanceOf(mockNonRebasing.address)).to.equal(
      ousdUnits("1"),
      "MockNonRebasing has incorrect balance after rebase"
    );
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
