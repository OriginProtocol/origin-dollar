const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { oethUnits, daiUnits, isFork, advanceTime } = require("../helpers");
const { hardhatSetBalance } = require("../_fund");

describe("WOETH", function () {
  if (isFork) {
    this.timeout(0);
  }

  let oeth, weth, woeth, oethVault, dai, matt, josh, governor;

  beforeEach(async () => {
    const fixture = await loadDefaultFixture();
    oeth = fixture.oeth;
    woeth = fixture.woeth;
    oethVault = fixture.oethVault;
    dai = fixture.dai;
    matt = fixture.matt;
    josh = fixture.josh;
    weth = fixture.weth;
    governor = fixture.governor;

    // mint some OETH
    for (const user of [matt, josh]) {
      await oethVault.connect(user).mint(weth.address, oethUnits("100"), 0);
    }

    // Josh wraps 50 OETH to WOETH
    await oeth.connect(josh).approve(woeth.address, oethUnits("1000"));
    await woeth.connect(josh).deposit(oethUnits("50"), josh.address);

    // rebase OETH balances in wallets by 2x
    await increaseOETHSupplyAndRebase(await oeth.totalSupply());
    for (i = 0; i < 122; i++) {
      await woeth.startYield();
      await advanceTime(10000);
    }
  });

  const increaseOETHSupplyAndRebase = async (wethAmount) => {
    await weth.connect(josh).deposit({ value: wethAmount });
    await weth.connect(josh).transfer(oethVault.address, wethAmount);
    await oethVault.connect(josh).rebase();
  };

  describe("General functionality", async () => {
    it("Initialize2 should not be called twice", async () => {
      // this function is already called by the fixture
      await expect(woeth.connect(governor).initialize2()).to.be.revertedWith(
        "Initialize2 already called"
      );
    });

    it("Initialize2 should not be called by non governor", async () => {
      await expect(woeth.connect(josh).initialize2()).to.be.revertedWith(
        "Caller is not the Governor"
      );
    });
  });

  describe("Funds in, Funds out", async () => {
    it("should deposit at the correct ratio", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(woeth).to.have.a.balanceOf("100", oeth);
      expect(await woeth.totalAssets()).to.equal(oethUnits("100"));
      await woeth.connect(josh).deposit(oethUnits("50"), josh.address);
      await expect(woeth).to.have.a.totalSupply("75");
      await expect(woeth).to.have.a.balanceOf("150", oeth);
      await expect(josh).to.have.a.balanceOf("75", woeth);
      await expect(josh).to.have.a.balanceOf("50", oeth);
    });

    it("should withdraw at the correct ratio", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await woeth
        .connect(josh)
        .withdraw(oethUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("25", woeth);
      await expect(josh).to.have.a.balanceOf("150", oeth);
      await expect(woeth).to.have.a.totalSupply("25");
    });
    it("should mint at the correct ratio", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await woeth.connect(josh).mint(oethUnits("25"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", woeth);
      await expect(josh).to.have.a.balanceOf("50", oeth);
      await expect(woeth).to.have.a.totalSupply("75");
    });

    it("should redeem at the correct ratio", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(josh).to.have.a.balanceOf("50", woeth);
      await woeth
        .connect(josh)
        .redeem(oethUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("0", woeth);
      await expect(josh).to.have.a.balanceOf("200", oeth);
      await expect(woeth).to.have.a.totalSupply("0");
    });

    it("should be able to redeem all WOETH", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(josh).to.have.a.balanceOf("50", woeth);
      await expect(matt).to.have.a.balanceOf("0", woeth);

      await oeth.connect(matt).approve(woeth.address, oethUnits("100"));
      await woeth.connect(matt).mint(oethUnits("50"), matt.address);

      await expect(woeth).to.have.a.totalSupply("100");
      await expect(await woeth.totalAssets()).to.equal(oethUnits("200"));

      // redeem all WOETH held by Josh and Matt
      await woeth
        .connect(josh)
        .redeem(oethUnits("50"), josh.address, josh.address);
      await woeth
        .connect(matt)
        .redeem(oethUnits("50"), matt.address, matt.address);

      await expect(josh).to.have.a.balanceOf("0", woeth);
      await expect(matt).to.have.a.balanceOf("0", woeth);
      await expect(josh).to.have.a.balanceOf("200", oeth);
      await expect(matt).to.have.a.balanceOf("200", oeth);
      await expect(woeth).to.have.a.totalSupply("0");
      await expect(await woeth.totalAssets()).to.equal(oethUnits("0"));
    });
  });

  describe("Collects Rebase", async () => {
    it("should increase with an OETH rebase", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(woeth).to.have.approxBalanceOf("100", oeth);
      await hardhatSetBalance(josh.address, "250");

      await increaseOETHSupplyAndRebase(oethUnits("200"));

      await expect(woeth).to.have.approxBalanceOf("150", oeth);
      await expect(woeth).to.have.a.totalSupply("50");
    });

    it("should not instantly increase exchange rate when OETH is transferred to the contract", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(woeth).to.have.approxBalanceOf("100", oeth);
      await expect(josh).to.have.a.balanceOf("50", woeth);

      // attempt to "attack" the contract to inflate the WOETH balance
      await oeth.connect(josh).transfer(woeth.address, oethUnits("50"));

      // redeeming 50 WOETH should still yield 100 OETH and not let the transfer
      // of OETH one line above affect it
      await woeth
        .connect(josh)
        .redeem(oethUnits("50"), josh.address, josh.address);

      await expect(josh).to.have.a.balanceOf("0", woeth);
      await expect(woeth).to.have.approxBalanceOf("50", oeth);
      await expect(await woeth.totalAssets()).to.equal("0");
      await expect(woeth).to.have.a.totalSupply("0");
    });

    it("should distributed yield over time", async () => {
      startingAssets = oethUnits("100");
      // Ten yield per s
      toDistribute = 10 * 24 * 60 * 60 + 25;
      // OETH has 400 total supply. WOETH has 100 OETH
      // So yield is multiped by 4
      await expect(woeth).to.have.a.balanceOf("100", oeth);
      await expect(await woeth.totalAssets()).to.equal(startingAssets);
      await increaseOETHSupplyAndRebase(4 * toDistribute + 3);

      await woeth.startYield();

      await expect(await oeth.balanceOf(woeth.address)).to.equal(
        startingAssets.add(toDistribute)
      );
      await expect(await woeth.yieldAssets()).to.equal(toDistribute);

      // Should not change the same block
      await expect(await woeth.totalAssets()).to.equal(startingAssets);
      // Next second, we should collect the second's yield, and any remaining rounding error
      await advanceTime(1);
      await expect(await woeth.totalAssets()).to.equal(startingAssets.add(10));
      await advanceTime(1);
      await expect(await woeth.totalAssets()).to.equal(
        startingAssets.add(2 * 10)
      );

      // Sudden donation here will not change yield schedule
      await increaseOETHSupplyAndRebase(100000000000);
      await woeth.startYield();

      // Yield continues. Previous donation commands advanced time 4 seconds
      await expect(await woeth.totalAssets()).to.equal(
        startingAssets.add(6 * 10)
      );
      // One block before the end. minus 10 and rounding error
      await advanceTime(24 * 60 * 60 - 7);
      await expect(await woeth.totalAssets()).to.equal(
        startingAssets.add(toDistribute).sub(11)
      );
      // End, should be exact
      await advanceTime(1);
      await expect(await woeth.totalAssets()).to.equal(
        startingAssets.add(toDistribute)
      );
      // After end, no change
      await advanceTime(1);
      await expect(await woeth.totalAssets()).to.equal(
        startingAssets.add(toDistribute)
      );
    });
  });

  describe("Check proxy", async () => {
    it("should have correct ERC20 properties", async () => {
      expect(await woeth.decimals()).to.eq(18);
      expect(await woeth.name()).to.eq("Wrapped OETH");
      expect(await woeth.symbol()).to.eq("wOETH");
    });
  });

  describe("Token recovery", async () => {
    it("should allow a governor to recover tokens", async () => {
      await dai.connect(matt).transfer(woeth.address, daiUnits("2"));
      await expect(woeth).to.have.a.balanceOf("2", dai);
      await expect(governor).to.have.a.balanceOf("1000", dai);
      await woeth.connect(governor).transferToken(dai.address, daiUnits("2"));
      await expect(woeth).to.have.a.balanceOf("0", dai);
      await expect(governor).to.have.a.balanceOf("1002", dai);
    });
    it("should not allow a governor to collect OETH", async () => {
      await expect(
        woeth.connect(governor).transferToken(oeth.address, oethUnits("2"))
      ).to.be.revertedWith("Cannot collect OETH");
    });
    it("should not allow a non governor to recover tokens ", async () => {
      await expect(
        woeth.connect(josh).transferToken(oeth.address, oethUnits("2"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });
});
