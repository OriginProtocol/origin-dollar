const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { impersonateAndFund } = require("../../utils/signers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Pause Safe Module (Base)", function () {
  this.timeout(0);

  let fixture;
  let pauseModule;
  let operator;

  beforeEach(async () => {
    fixture = await baseFixture();
    pauseModule = await ethers.getContract("PauseSafeModule");
    operator = await impersonateAndFund(addresses.talosRelayer);
  });

  it("Should be enabled on the Guardian Safe", async () => {
    const safe = await ethers.getContractAt(
      ["function isModuleEnabled(address module) external view returns (bool)"],
      addresses.multichainStrategist
    );
    expect(await safe.isModuleEnabled(pauseModule.address)).to.be.true;
  });

  it("Should have the OETHb vault allow-listed", async () => {
    const { oethbVault } = fixture;
    expect(await pauseModule.isPausableTarget(oethbVault.address)).to.be.true;
  });

  it("Should let the operator pause capital, and only the admin lift it", async () => {
    const { admin, oethbVault, strategist } = fixture;

    expect(await oethbVault.capitalPaused()).to.be.false;

    await pauseModule.connect(operator).pauseCapital(oethbVault.address);
    expect(await oethbVault.capitalPaused()).to.be.true;

    await expect(
      oethbVault.connect(strategist).unpauseCapital()
    ).to.be.revertedWith("Caller is not the Admin or Governor");
    expect(await oethbVault.capitalPaused()).to.be.true;

    await oethbVault.connect(admin).unpauseCapital();
    expect(await oethbVault.capitalPaused()).to.be.false;
  });

  it("Should let the operator pause rebase", async () => {
    const { admin, oethbVault } = fixture;

    await pauseModule.connect(operator).pauseRebase(oethbVault.address);
    expect(await oethbVault.rebasePaused()).to.be.true;

    await oethbVault.connect(admin).unpauseRebase();
    expect(await oethbVault.rebasePaused()).to.be.false;
  });

  it("Should revert for a non-operator", async () => {
    const { nick, oethbVault } = fixture;

    await expect(
      pauseModule.connect(nick).pauseCapital(oethbVault.address)
    ).to.be.revertedWith("Caller is not an operator");
  });
});
