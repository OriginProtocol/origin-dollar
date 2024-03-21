const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");
const { utils } = require("ethers");

const { daiUnits, ousdUnits, usdcUnits, isFork } = require("../helpers");

describe("Token", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should return the token name and symbol", async () => {
    const { ousd } = fixture;
    expect(await ousd.name()).to.equal("Origin Dollar");
    expect(await ousd.symbol()).to.equal("OUSD");
  });

  it("Should have 18 decimals", async () => {
    const { ousd } = fixture;
    expect(await ousd.decimals()).to.equal(18);
  });

  it("Should return 0 balance for the zero address", async () => {
    const { ousd } = fixture;
    expect(
      await ousd.balanceOf("0x0000000000000000000000000000000000000000")
    ).to.equal(0);
  });

  it("Should not allow anyone to mint OUSD directly", async () => {
    const { ousd, matt } = fixture;
    await expect(
      ousd.connect(matt).mint(matt.getAddress(), ousdUnits("100"))
    ).to.be.revertedWith("Caller is not the Vault");
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should allow a simple transfer of 1 OUSD", async () => {
    const { ousd, anna, matt } = fixture;
    await expect(anna).has.a.balanceOf("0", ousd);
    await expect(matt).has.a.balanceOf("100", ousd);
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expect(anna).has.a.balanceOf("1", ousd);
    await expect(matt).has.a.balanceOf("99", ousd);
  });

  it("Should allow a transferFrom with an allowance", async () => {
    const { ousd, anna, matt } = fixture;
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
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account without previously set creditssPerToken to a rebasing account", async () => {
    let { ousd, matt, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account to a non-rebasing account with different previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing, mockNonRebasingTwo } =
      fixture;
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
    await mockNonRebasing.transfer(mockNonRebasingTwo.address, ousdUnits("10"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("40", ousd);
    await expect(mockNonRebasingTwo).has.an.approxBalanceOf("60", ousd);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const creditBalanceMockNonRebasing = await ousd.creditsBalanceOf(
      mockNonRebasing.address
    );
    const balanceMockNonRebasing = creditBalanceMockNonRebasing[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasing[1]);
    const creditBalanceMockNonRebasingTwo = await ousd.creditsBalanceOf(
      mockNonRebasingTwo.address
    );
    const balanceMockNonRebasingTwo = creditBalanceMockNonRebasingTwo[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasingTwo[1]);

    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(balanceMockNonRebasing)
      .add(balanceMockNonRebasingTwo);

    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account without previously set creditsPerToken to a rebasing account", async () => {
    let { ousd, matt, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

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

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should maintain the correct balances when rebaseOptIn is called from non-rebasing contract", async () => {
    let { ousd, vault, matt, usdc, josh, mockNonRebasing } = fixture;

    // Give contract 99.50 OUSD from Josh
    // This will set a nonrebasingCreditsPerTokenHighres for this account
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("99.50"));

    const initialRebasingCredits = await ousd.rebasingCreditsHighres();
    const initialTotalSupply = await ousd.totalSupply();

    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    const totalSupplyBefore = await ousd.totalSupply();
    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", ousd);

    const rebaseTx = await mockNonRebasing.rebaseOptIn();
    await expect(rebaseTx)
      .to.emit(ousd, "AccountRebasingEnabled")
      .withArgs(mockNonRebasing.address);

    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", ousd);
    expect(await ousd.totalSupply()).to.equal(totalSupplyBefore);

    const rebasingCredits = await ousd.rebasingCreditsHighres();
    const rebasingCreditsPerTokenHighres =
      await ousd.rebasingCreditsPerTokenHighres();

    const creditsAdded = ousdUnits("99.50")
      .mul(rebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.add(creditsAdded)
    );

    expect(await ousd.totalSupply()).to.approxEqual(
      initialTotalSupply.add(utils.parseUnits("200", 18))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should maintain the correct balance when rebaseOptOut is called from rebasing EOA", async () => {
    let { ousd, vault, matt, usdc } = fixture;
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    const totalSupplyBefore = await ousd.totalSupply();

    const initialRebasingCredits = await ousd.rebasingCreditsHighres();
    const initialrebasingCreditsPerTokenHighres =
      await ousd.rebasingCreditsPerTokenHighres();

    const rebaseTx = await ousd.connect(matt).rebaseOptOut();
    await expect(rebaseTx)
      .to.emit(ousd, "AccountRebasingDisabled")
      .withArgs(matt.address);

    // Received 100 from the rebase, the 200 simulated yield was split between
    // Matt and Josh
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);

    const rebasingCredits = await ousd.rebasingCreditsHighres();

    const creditsDeducted = ousdUnits("200")
      .mul(initialrebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.sub(creditsDeducted)
    );

    expect(await ousd.totalSupply()).to.equal(totalSupplyBefore);
  });

  it("Should not allow EOA to call rebaseOptIn when already opted in to rebasing", async () => {
    let { ousd, matt } = fixture;
    await expect(ousd.connect(matt).rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow EOA to call rebaseOptOut when already opted out of rebasing", async () => {
    let { ousd, matt } = fixture;
    await ousd.connect(matt).rebaseOptOut();
    await expect(ousd.connect(matt).rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should not allow contract to call rebaseOptIn when already opted in to rebasing", async () => {
    let { mockNonRebasing } = fixture;
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing.rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow contract to call rebaseOptOut when already opted out of rebasing", async () => {
    let { mockNonRebasing } = fixture;
    await expect(mockNonRebasing.rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should maintain the correct balance on a partial transfer for a non-rebasing account without previously set creditsPerToken", async () => {
    let { ousd, matt, josh, mockNonRebasing } = fixture;

    // Opt in to rebase so contract doesn't set a fixed creditsPerToken for the contract
    await mockNonRebasing.rebaseOptIn();
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", ousd);
    await ousd.connect(matt).rebaseOptOut();
    // Transfer will cause a fixed creditsPerToken to be set for mockNonRebasing
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", ousd);
    await expect(matt).has.an.approxBalanceOf("150", ousd);
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("25"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("25", ousd);
    await expect(matt).has.an.approxBalanceOf("175", ousd);
  });

  it("Should maintain the same totalSupply on many transfers between different account types", async () => {
    let { ousd, matt, josh, mockNonRebasing, mockNonRebasingTwo } = fixture;

    // Only Matt and Josh have OUSD, give some to contracts
    await ousd.connect(josh).transfer(mockNonRebasing.address, ousdUnits("50"));
    await ousd
      .connect(matt)
      .transfer(mockNonRebasingTwo.address, ousdUnits("50"));

    // Set up accounts
    await ousd.connect(josh).rebaseOptOut();
    const nonRebasingEOA = josh;
    const rebasingEOA = matt;
    const nonRebasingContract = mockNonRebasing;
    await mockNonRebasingTwo.rebaseOptIn();
    const rebasingContract = mockNonRebasingTwo;

    const allAccounts = [
      nonRebasingEOA,
      rebasingEOA,
      nonRebasingContract,
      rebasingContract,
    ];

    const initialTotalSupply = await ousd.totalSupply();
    for (let i = 0; i < 10; i++) {
      for (const fromAccount of allAccounts) {
        const toAccount =
          allAccounts[Math.floor(Math.random() * allAccounts.length)];

        if (typeof fromAccount.transfer === "function") {
          // From account is a contract
          await fromAccount.transfer(
            toAccount.address,
            (await ousd.balanceOf(fromAccount.address)).div(2)
          );
        } else {
          // From account is a EOA
          await ousd
            .connect(fromAccount)
            .transfer(
              toAccount.address,
              (await ousd.balanceOf(fromAccount.address)).div(2)
            );
        }

        await expect(await ousd.totalSupply()).to.equal(initialTotalSupply);
      }
    }
  });

  it("Should revert a transferFrom if an allowance is insufficient", async () => {
    const { ousd, anna, matt } = fixture;
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
    ).to.be.revertedWith("panic code 0x11");
  });

  it("Should allow to increase/decrease allowance", async () => {
    const { ousd, anna, matt } = fixture;
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
    const { ousd, usdc, vault, anna, matt } = fixture;
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

  it("Should mint correct amounts on non-rebasing account without previously set creditsPerToken", async () => {
    let { ousd, dai, vault, josh, mockNonRebasing } = fixture;

    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", ousd);
    const totalSupplyBefore = await ousd.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    const tx = await mockNonRebasing.mintOusd(
      vault.address,
      dai.address,
      daiUnits("50")
    );
    await expect(tx)
      .to.emit(ousd, "AccountRebasingDisabled")
      .withArgs(mockNonRebasing.address);

    await expect(await ousd.totalSupply()).to.equal(
      totalSupplyBefore.add(ousdUnits("50"))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await ousd.nonRebasingSupply()).to.approxEqual(
      ousdUnits("50")
    );
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should mint correct amounts on non-rebasing account with previously set creditsPerToken", async () => {
    let { ousd, dai, vault, matt, usdc, josh, mockNonRebasing } = fixture;
    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", ousd);
    const totalSupplyBefore = await ousd.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    await mockNonRebasing.mintOusd(vault.address, dai.address, daiUnits("50"));
    await expect(await ousd.totalSupply()).to.equal(
      totalSupplyBefore.add(ousdUnits("50"))
    );
    const contractCreditsBalanceOf = await ousd.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await ousd.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Mint again
    await mockNonRebasing.mintOusd(vault.address, dai.address, daiUnits("50"));
    await expect(await ousd.totalSupply()).to.equal(
      // Note 200 additional from simulated yield
      totalSupplyBefore.add(ousdUnits("100")).add(ousdUnits("200"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("100", ousd);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await ousd.nonRebasingSupply()).to.approxEqual(
      ousdUnits("100")
    );
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should burn the correct amount for non-rebasing account", async () => {
    let { ousd, dai, vault, matt, usdc, josh, mockNonRebasing } = fixture;
    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", ousd);
    const totalSupplyBefore = await ousd.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    await mockNonRebasing.mintOusd(vault.address, dai.address, daiUnits("50"));
    await expect(await ousd.totalSupply()).to.equal(
      totalSupplyBefore.add(ousdUnits("50"))
    );
    const contractCreditsBalanceOf = await ousd.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await ousd.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Burn OUSD
    await mockNonRebasing.redeemOusd(vault.address, ousdUnits("25"));
    await expect(await ousd.totalSupply()).to.equal(
      // Note 200 from simulated yield
      totalSupplyBefore.add(ousdUnits("225"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("25", ousd);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await ousd.nonRebasingSupply()).to.approxEqual(
      ousdUnits("25")
    );
    const calculatedTotalSupply = (await ousd.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerTokenHighres())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should exact transfer to new contract accounts", async () => {
    let { ousd, vault, matt, usdc, mockNonRebasing } = fixture;

    // Add yield to so we need higher resolution
    await usdc.connect(matt).mint(usdcUnits("9671.2345"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("9671.2345"));
    await vault.rebase();

    // Helper to verify balance-exact transfers in
    const checkTransferIn = async (amount) => {
      const beforeReceiver = await ousd.balanceOf(mockNonRebasing.address);
      await ousd.connect(matt).transfer(mockNonRebasing.address, amount);
      const afterReceiver = await ousd.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.add(amount)).to.equal(afterReceiver);
    };

    // Helper to verify balance-exact transfers out
    const checkTransferOut = async (amount) => {
      const beforeReceiver = await ousd.balanceOf(mockNonRebasing.address);
      await mockNonRebasing.transfer(matt.address, amount);
      const afterReceiver = await ousd.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.sub(amount)).to.equal(afterReceiver);
    };

    // In
    await checkTransferIn(1);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);
    await checkTransferIn(100);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);

    // Out
    await checkTransferOut(1);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
    await checkTransferOut(100);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
  });
});
