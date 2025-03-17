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

  describe("Check proxy", async () => {
    it("should have correct ERC20 properties", async () => {
      expect(await wousd.decimals()).to.eq(18);
      expect(await wousd.name()).to.eq("Wrapped OUSD");
      expect(await wousd.symbol()).to.eq("WOUSD");
    });
  });

  describe("WOUSD upgrade", async () => {
    it("should be upgradable", async () => {
      // Do upgrade
      const cWrappedOUSDProxy = await ethers.getContract("WrappedOUSDProxy");
      const cVaultProxy = await ethers.getContract("VaultProxy");
      const factory = await ethers.getContractFactory("MockLimitedWrappedOusd");
      const dNewImpl = await factory.deploy(ousd.address, cVaultProxy.address);
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
