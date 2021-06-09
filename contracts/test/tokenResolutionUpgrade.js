const { expect, assert } = require("chai");
const { defaultFixture } = require("./_fixture");
const { utils } = require("ethers");

const {
  daiUnits,
  ousdUnits,
  usdcUnits,
  isFork,
  loadFixture,
} = require("./helpers");

describe("Token", function () {
  if (isFork) {
    this.timeout(0);
  }

  const withResolutionUpgrader = async function (fixture, fn) {
    const ousdProxy = await ethers.getContract("OUSDProxy");
    const ousdImpl = await ethers.getContract("OUSD");
    const upgraderImpl = await ethers.getContract("OUSDResolutionUpgrade");

    // Switch to upgrader contract
    await ousdProxy.connect(fixture.governor).upgradeTo(upgraderImpl.address);
    const upgrader = upgraderImpl.attach(fixture.ousd.address);
    // Call code to run during upgrade process
    await fn(upgrader);
    // Back to OUSD as the implementation
    await ousdProxy.connect(fixture.governor).upgradeTo(ousdImpl.address);
  };

  it.only("can upgrade credit amounts", async function () {
    const fixture = await loadFixture(defaultFixture);
    let { ousd, vault, matt, josh, mockNonRebasing } = fixture;

    await ousd.connect(josh).transfer(mockNonRebasing.address, ousdUnits("50"));

    const allAccounts = [josh.address, matt.address, mockNonRebasing.address];
    const befores = {};
    for (const account of allAccounts) {
      befores[account] = await ousd.balanceOf(account);
    }
    await withResolutionUpgrader(fixture, async function (upgrader) {
      await upgrader.upgradeGlobals();
      await upgrader.upgradeAccounts(allAccounts);
    });

    for (const account of allAccounts) {
      const before = befores[account];
      const after = await ousd.balanceOf(account);
      expect(after).to.equal(before);
    }
  });
});
