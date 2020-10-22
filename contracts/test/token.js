const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");

const {
  ousdUnits,
  usdcUnits,
  isGanacheFork,
  loadFixture,
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

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    const contractCreditsPerToken = await ousd.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await ousd.creditsBalanceOf(mockNonRebasing.address));
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", ousd);
    // Give contract 100 OUSD from Matt
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", ousd);
  });

  it("Should transfer the correct amount from a non-rebasing account to a rebasing account without previously set creditsPerToken", async () => {
    let { ousd, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);
  });

  it("Should transfer the correct amount from a non-rebasing account to a rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", ousd);
    // Give contract 100 OUSD from Matt
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", ousd);
    // Transfer contract balance to Josh
    await mockNonRebasing.transfer(await josh.getAddress(), ousdUnits("150"));
    await expect(matt).has.an.approxBalanceOf("250", ousd);
    await expect(josh).has.an.approxBalanceOf("150", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);
  });

  it("Should transfer the correct amount from a non-rebasing account to a non-rebasing account with different previously set creditsPerToken", async () => {
    let {
      ousd,
      vault,
      matt,
      usdc,
      josh,
      mockNonRebasing,
      mockNonRebasingTwo,
    } = await loadFixture(defaultFixture);
    // Give contract 100 OUSD from Josh
    await ousd.connect(josh).transfer(mockNonRebasing.address, ousdUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    await ousd
      .connect(josh)
      .transfer(mockNonRebasingTwo.address, ousdUnits("50"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("100"));
    await vault.rebase();
    await mockNonRebasing.transfer(mockNonRebasingTwo.address, ousdUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasingTwo).has.an.approxBalanceOf("100", ousd);
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give Josh an allowance to move Matt's OUSD
    await ousd
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), ousdUnits("100"));
    // Give contract 100 OUSD from Matt via Josh
    await ousd
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        ousdUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    const contractCreditsPerToken = await ousd.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await ousd.creditsBalanceOf(mockNonRebasing.address));
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give Josh an allowance to move Matt's OUSD
    await ousd
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), ousdUnits("150"));
    // Give contract 100 OUSD from Matt via Josh
    await ousd
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        ousdUnits("50")
      );
    await expect(matt).has.an.approxBalanceOf("50", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Give contract 50 more OUSD from Matt via Josh
    await ousd
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        ousdUnits("50")
      );
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", ousd);
  });

  it("Should transferFrom the correct amount from a non-rebasing account to a rebasing account without previously set creditsPerToken", async () => {
    let { ousd, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      ousdUnits("100")
    );

    await ousd
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        ousdUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);
  });

  it("Should transferFrom the correct amount from a non-rebasing account to a rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", ousd);
    // Give contract 100 OUSD from Matt
    await ousd.connect(matt).transfer(mockNonRebasing.address, ousdUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", ousd);
    // Transfer contract balance to Josh
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      ousdUnits("150")
    );

    await ousd
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        ousdUnits("150")
      );

    await expect(matt).has.an.approxBalanceOf("400", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);
  });

  it("Should maintain the correct balances when rebaseOptIn is called from non-rebasing account", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    const totalSupplyBefore = await ousd.totalSupply();
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.equal(totalSupplyBefore);
  });

  it("Should maintain the correct balance when rebaseOptOut is called from non-rebasing account", async () => {
    let { ousd, vault, matt, usdc } = await loadFixture(defaultFixture);
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    const totalSupplyBefore = await ousd.totalSupply();
    await ousd.connect(matt).rebaseOptOut();
    // Received 100 from the rebase, the 200 simulated yield was split between
    // Matt and Josh
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);
    expect(await ousd.totalSupply()).to.equal(totalSupplyBefore);
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
      .decreaseAllowance(await anna.getAddress(), ousdUnits("100"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("900"));

    // Increase allowance
    await ousd
      .connect(matt)
      .increaseAllowance(await anna.getAddress(), ousdUnits("20"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("920"));

    // Decrease allowance more than what's there
    await ousd
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), ousdUnits("950"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("0"));
  });

  it("Should increase users balance on supply increase", async () => {
    const { ousd, usdc, vault, anna, matt } = await loadFixture(defaultFixture);
    // Transfer 1 to Anna, so we can check different amounts
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expect(matt).has.a.balanceOf("99", ousd);
    await expect(anna).has.a.balanceOf("1", ousd);

    // Increase total supply thus increasing all user's balances
    await usdc.connect(matt).mint(usdcUnits("2"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/200) * 202 OUSD
    await expect(matt).has.a.balanceOf("99.99", ousd);
    // Anna should have (1/200) * 202 OUSD
    await expect(anna).has.a.balanceOf("1.01", ousd);
  });
});
