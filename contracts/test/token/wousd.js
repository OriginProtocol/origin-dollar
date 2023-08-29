const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { ousdUnits, daiUnits, isFork } = require("../helpers");

describe("WOUSD", function () {
  if (isFork) {
    this.timeout(0);
  }

  let ousd, wousd, vault, dai, matt, josh, governor;

  beforeEach(async () => {
    const fixture = await loadDefaultFixture();
    ousd = fixture.ousd;
    wousd = fixture.wousd;
    vault = fixture.vault;
    dai = fixture.dai;
    matt = fixture.matt;
    josh = fixture.josh;
    governor = fixture.governor;

    // Josh wraps 50
    await ousd.connect(josh).approve(wousd.address, ousdUnits("1000"));
    await wousd.connect(josh).deposit(ousdUnits("50"), josh.address);
    // Matt gives money to wOUSD, which counts as yield and changes the effective price of WOUSD
    // 1 WOUSD will be worth 2 OUSD
    await ousd.connect(matt).transfer(wousd.address, ousdUnits("50"));
  });

  describe("Funds in, Funds out", async () => {
    it("should deposit at the correct ratio", async () => {
      await wousd.connect(josh).deposit(ousdUnits("50"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wousd);
      await expect(josh).to.have.a.balanceOf("0", ousd);
    });
    it("should withdraw at the correct ratio", async () => {
      await wousd
        .connect(josh)
        .withdraw(ousdUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("25", wousd);
      await expect(josh).to.have.a.balanceOf("100", ousd);
    });
    it("should mint at the correct ratio", async () => {
      await wousd.connect(josh).mint(ousdUnits("25"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wousd);
      await expect(josh).to.have.a.balanceOf("0", ousd);
    });
    it("should redeem at the correct ratio", async () => {
      await expect(josh).to.have.a.balanceOf("50", wousd);
      await wousd
        .connect(josh)
        .redeem(ousdUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("0", wousd);
      await expect(josh).to.have.a.balanceOf("150", ousd);
    });
  });

  describe("Collects Rebase", async () => {
    it("should increase with an OUSD rebase", async () => {
      await expect(wousd).to.have.approxBalanceOf("100", ousd);
      await dai.connect(josh).transfer(vault.address, daiUnits("100"));
      await vault.rebase();
      await expect(wousd).to.have.approxBalanceOf("150", ousd);
    });
  });

  describe("Check proxy", async () => {
    it("should have correct ERC20 properties", async () => {
      expect(await wousd.decimals()).to.eq(18);
      expect(await wousd.name()).to.eq("Wrapped OUSD");
      expect(await wousd.symbol()).to.eq("WOUSD");
    });
  });

  describe("Token recovery", async () => {
    it("should allow a governor to recover tokens", async () => {
      await dai.connect(matt).transfer(wousd.address, daiUnits("2"));
      await expect(wousd).to.have.a.balanceOf("2", dai);
      await expect(governor).to.have.a.balanceOf("1000", dai);
      await wousd.connect(governor).transferToken(dai.address, daiUnits("2"));
      await expect(wousd).to.have.a.balanceOf("0", dai);
      await expect(governor).to.have.a.balanceOf("1002", dai);
    });
    it("should not allow a governor to collect OUSD", async () => {
      await expect(
        wousd.connect(governor).transferToken(ousd.address, ousdUnits("2"))
      ).to.be.revertedWith("Cannot collect OUSD");
    });
    it("should not allow a non governor to recover tokens ", async () => {
      await expect(
        wousd.connect(josh).transferToken(ousd.address, ousdUnits("2"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("WOUSD upgrade", async () => {
    it("should be upgradable", async () => {
      // Do upgrade
      const cWrappedOUSDProxy = await ethers.getContract("WrappedOUSDProxy");
      const factory = await ethers.getContractFactory("MockLimitedWrappedOusd");
      const dNewImpl = await factory.deploy(
        ousd.address,
        "WOUSD",
        "Wrapped OUSD"
      );
      await cWrappedOUSDProxy.connect(governor).upgradeTo(dNewImpl.address);

      // Test basics
      expect(await wousd.decimals()).to.eq(18);
      expect(await wousd.name()).to.eq("Wrapped OUSD");
      expect(await wousd.symbol()).to.eq("WOUSD");

      // Test previous balance
      await expect(wousd).to.have.a.balanceOf("100", ousd);
      await expect(josh).to.have.a.balanceOf("50", wousd);
      await expect(matt).to.have.a.balanceOf("0", wousd);

      // Upgraded contract will only allow deposits of up to 1 OUSD
      await wousd.connect(josh).deposit(ousdUnits("1"), josh.address);
      await expect(
        wousd.connect(josh).deposit(ousdUnits("25"), josh.address)
      ).to.be.revertedWith("ERC4626: deposit more then max");
    });
  });
});
