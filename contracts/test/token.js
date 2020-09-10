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

  it("Should not change balance of frozen account when rebasing", async () => {
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

  it(
    "Should have a correct total supply when transferring from a frozen to a non-frozen account"
  );

  it(
    "Should have a correct total supply when transferring from a non-frozen to a frozen account"
  );

  it("Should add a frozen account to the exception list", async () => {
    const { ousd, vault, matt, mockFrozen } = await loadFixture(defaultFixture);
    await mockFrozen.setOUSD(ousd.address);
    // Transfer 1 OUSD to Vault, a contract, which will have a non-rebasing balance
    await ousd.connect(matt).transfer(mockFrozen.address, ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(await ousd.balanceOf(mockFrozen.address)).to.equal(
      ousdUnits("1")
    );

    // Unfreeze the account, i.e. expose it to rebasing
    await mockFrozen.unfreeze();
    // Balance should remain the same
    await expect(await ousd.balanceOf(mockFrozen.address)).to.equal(
      ousdUnits("1"),
      "MockFrozen has incorrect balance before rebase"
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
    await expect(await ousd.balanceOf(mockFrozen.address)).to.equal(
      ousdUnits("1.01"),
      "MockFrozen has incorrect balance after rebase"
    );
  });

  it("Should remove a frozen account from the exception list");
});
