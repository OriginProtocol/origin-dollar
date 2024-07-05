const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { oethUnits, daiUnits, isFork } = require("../helpers");
const { hardhatSetBalance } = require("../_fund");
const { impersonateAndFund } = require("../../utils/signers");

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

    // START: below steps raise the worth of 1 WOETH from 1 to 2 OETH units
    const oethSupply = await oeth.totalSupply();
    await weth.connect(josh).deposit({ value: oethSupply });
    // send 50% of the WETH to inc
    await weth.connect(josh).transfer(oethVault.address, oethSupply);
    await oethVault.connect(josh).rebase();
    // END OF raising worth of WOETH

    // josh account starts each test with 100 OETH
  });

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
      await woeth.connect(josh).deposit(oethUnits("50"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", woeth);
      await expect(josh).to.have.a.balanceOf("50", oeth);
      await expect(woeth).to.have.a.totalSupply("75");
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
  });

  describe("Collects Rebase", async () => {
    it("should increase with an OETH rebase", async () => {
      await expect(woeth).to.have.a.totalSupply("50");
      await expect(woeth).to.have.approxBalanceOf("100", oeth);
      await hardhatSetBalance(josh.address, "250");
      await weth.connect(josh).deposit({ value: oethUnits("200") });
      await weth.connect(josh).transfer(oethVault.address, oethUnits("200"));
      await oethVault.rebase();
      await expect(woeth).to.have.approxBalanceOf("150", oeth);
      await expect(woeth).to.have.a.totalSupply("50");
    });
    it("should not increase exchange rate when OETH is transferred to the contract", async () => {
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
  });

  describe("Check proxy", async () => {
    it("should have correct ERC20 properties", async () => {
      expect(await woeth.decimals()).to.eq(18);
      expect(await woeth.name()).to.eq("Wrapped OETH");
      expect(await woeth.symbol()).to.eq("WOETH");
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
    it("should allow a governor to collect less than OETH surplus", async () => {
      await oeth.connect(josh).transfer(woeth.address, oethUnits("2"));
      await expect(woeth).to.have.a.balanceOf("102", oeth);
      await woeth.connect(governor).transferToken(oeth.address, oethUnits("1"));
      await expect(woeth).to.have.a.balanceOf("101", oeth);
      await expect(governor).to.have.a.balanceOf("1", oeth);
      await expect(await woeth.totalAssets()).to.equal(oethUnits("100"));
    });
    it("should allow a governor to collect exact OETH surplus", async () => {
      await oeth.connect(josh).transfer(woeth.address, oethUnits("2"));
      await expect(woeth).to.have.a.balanceOf("102", oeth);
      await woeth.connect(governor).transferToken(oeth.address, oethUnits("2"));
      await expect(woeth).to.have.a.balanceOf("100", oeth);
      await expect(governor).to.have.a.balanceOf("2", oeth);
      await expect(await woeth.totalAssets()).to.equal(oethUnits("100"));
    });
    it("should not a allow governor to collect more than OETH surplus before rebase", async () => {
      await oeth.connect(josh).transfer(woeth.address, oethUnits("2"));
      await expect(woeth).to.have.a.balanceOf("102", oeth);
      await expect(
        woeth.connect(governor).transferToken(oeth.address, oethUnits("3"))
      ).to.be.revertedWith("Can only collect surplus");
    });
    it("should not a allow governor to collect more than OETH surplus after rebase", async () => {
      await oeth.connect(josh).transfer(woeth.address, oethUnits("2"));
      await expect(woeth).to.have.a.balanceOf("102", oeth);

      // OETH rebase to increase the worth of WOETH by x2.
      const oethSupply = await oeth.totalSupply();
      await hardhatSetBalance(josh.address, (oethSupply * 1.1).toString());
      await weth.connect(josh).deposit({ value: oethSupply });
      await weth.connect(josh).transfer(oethVault.address, oethSupply);
      await oethVault.rebase();
      await expect(woeth).to.have.a.balanceOf("204", oeth);

      // Governor cannot collect more than 4 OETH (2x the original 2 OETH transferred)
      await expect(
        woeth.connect(governor).transferToken(oeth.address, oethUnits("4") + 1)
      ).to.be.revertedWith("Can only collect surplus");
      await woeth.connect(governor).transferToken(oeth.address, oethUnits("4"));
      await expect(woeth).to.have.a.balanceOf("200", oeth);
    });
    it("should not allow a non governor to recover tokens ", async () => {
      await expect(
        woeth.connect(josh).transferToken(oeth.address, oethUnits("2"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });
});
