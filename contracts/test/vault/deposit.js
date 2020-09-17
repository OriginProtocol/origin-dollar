const { defaultFixture, compoundVaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  usdcUnits,
  ousdUnits,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("Vault deposit pausing", async () => {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Non-governor cannot pause", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseDeposits()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Non-governor cannot unpause", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).unpauseDeposits()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Pausing deposits stops deposits", async () => {
    const { anna, governor, vault, usdc } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.true;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"))).to
      .be.reverted;
  });

  it("Unpausing deposits allows deposits", async () => {
    const { anna, governor, vault, usdc } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.true;
    await vault.connect(governor).unpauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.false;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
  });

  it("Deposit pause status can be read", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    expect(await vault.connect(anna).depositPaused()).to.be.false;
  });
});

describe("Vault auto allocation", async () => {
  if (isGanacheFork) {
    this.timeout(0);
  }

  const mintDoesAllocate = async (amount) => {
    const { anna, vault, usdc, governor } = await loadFixture(
      compoundVaultFixture
    );
    await vault.connect(governor).setVaultBuffer(0);
    await vault.allocate();
    await usdc.connect(anna).mint(usdcUnits(amount));
    await usdc.connect(anna).approve(vault.address, usdcUnits(amount));
    await vault.connect(anna).mint(usdc.address, usdcUnits(amount));
    return (await usdc.balanceOf(vault.address)).isZero();
  };

  const setThreshold = async (amount) => {
    const { vault, governor } = await loadFixture(compoundVaultFixture);
    await vault.connect(governor).setAutoAllocateThreshold(ousdUnits(amount));
  };

  it("Triggers auto allocation at the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25000")).to.be.true;
  });

  it("Triggers auto allocation above the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25001")).to.be.true;
  });

  it("Does not trigger auto allocation below the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("24999")).to.be.false;
  });

  it("Governer can change the threshold", async () => {
    await setThreshold("25000");
  });

  it("Non-governer cannot change the threshold", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).setAutoAllocateThreshold(10000)).to.be
      .reverted;
  });
});
