const { compoundVaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { usdcUnits, loadFixture, isFork } = require("../helpers");

describe("Vault deposit pausing", async () => {
  if (isFork) {
    this.timeout(0);
  }

  it("Governor can pause and unpause", async () => {
    const { anna, governor, vault } = await loadFixture(compoundVaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Strategist can pause and unpause", async () => {
    const { anna, strategist, vault } = await loadFixture(compoundVaultFixture);
    await vault.connect(strategist).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(strategist).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Other can not pause and unpause", async () => {
    const { anna, vault } = await loadFixture(compoundVaultFixture);
    await expect(vault.connect(anna).pauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Pausing deposits stops mint", async () => {
    const { anna, governor, vault, usdc } = await loadFixture(
      compoundVaultFixture
    );
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0))
      .to.be.reverted;
  });

  it("Unpausing deposits allows mint", async () => {
    const { anna, governor, vault, usdc } = await loadFixture(
      compoundVaultFixture
    );
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
  });

  it("Deposit pause status can be read", async () => {
    const { anna, vault } = await loadFixture(compoundVaultFixture);
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });
});
