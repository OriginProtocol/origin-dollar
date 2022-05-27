const { compoundVaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { loadFixture, isFork } = require("../helpers");

describe("Pausable Vault Configuration", async () => {
  if (isFork) {
    this.timeout(0);
  }

  it("Governor can pause and unpause", async () => {
    const { governor, vault } = await loadFixture(compoundVaultFixture);
    await vault.connect(governor).pause();
    expect(await vault.paused()).to.be.true;
    expect(await vault.paused()).to.be.true;

    await vault.connect(governor).unpause();
    expect(await vault.paused()).to.be.false;
    expect(await vault.paused()).to.be.false;
  });

  it("Governor can set pauser", async () => {
    const { anna, governor, vault } = await loadFixture(compoundVaultFixture);
    await expect(vault.connect(governor).setPauser(anna.address))
      .to.emit(vault, "PauserChanged")
      .withArgs(anna.address);
    expect(await vault.pauser()).to.eq(anna.address);
  });
});
