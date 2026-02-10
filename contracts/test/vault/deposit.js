const { expect } = require("chai");

const { createFixtureLoader, defaultFixture } = require("../_fixture");
const { usdcUnits, isFork } = require("../helpers");

describe("Vault deposit pausing", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  const loadFixture = createFixtureLoader(defaultFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Governor can pause and unpause", async () => {
    const { anna, governor, vault } = fixture;
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Strategist can pause and unpause", async () => {
    const { anna, strategist, vault } = fixture;
    await vault.connect(strategist).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(strategist).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Other can not pause and unpause", async () => {
    const { anna, vault } = fixture;
    await expect(vault.connect(anna).pauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Pausing deposits stops mint", async () => {
    const { anna, governor, vault, usdc } = fixture;
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await expect(vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0))
      .to.be.reverted;
  });

  it("Unpausing deposits allows mint", async () => {
    const { anna, governor, vault, usdc } = fixture;
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
  });

  it("Deposit pause status can be read", async () => {
    const { anna, vault } = fixture;
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });
});
