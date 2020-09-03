const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { usdcUnits, loadFixture } = require("../helpers");

describe("Vault deposit pausing", async () => {
  let vault, usdc, governor, anna;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    governor = fixture.governor;
    anna = fixture.anna;
    usdc = fixture.usdc;
  });

  it("Non-governor cannot pause", async () => {
    await expect(vault.connect(anna).pauseDeposits()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Non-governor cannot unpause", async () => {
    await expect(vault.connect(anna).unpauseDeposits()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Pausing deposits stops deposits", async () => {
    await vault.connect(governor).pauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.true;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"))).to
      .be.reverted;
  });

  it("Unpausing deposits allows deposits", async () => {
    await vault.connect(governor).pauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.true;
    await vault.connect(governor).unpauseDeposits();
    expect(await vault.connect(anna).depositPaused()).to.be.false;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"));
  });

  it("Deposit pause status can be read", async () => {
    expect(await vault.connect(anna).depositPaused()).to.be.false;
  });
});
