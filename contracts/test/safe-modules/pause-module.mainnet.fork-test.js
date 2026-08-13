const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("../_fixture");
const { isCI } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

describe("ForkTest: Pause Safe Module", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;
  let pauseModule;
  let operator;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();
    pauseModule = await ethers.getContract("PauseSafeModule");
    operator = await impersonateAndFund(addresses.talosRelayer);
  });

  it("Should have the expected operator", async () => {
    const operatorRole = await pauseModule.OPERATOR_ROLE();
    expect(await pauseModule.hasRole(operatorRole, addresses.talosRelayer)).to
      .be.true;
  });

  it("Should be enabled on the Guardian Safe", async () => {
    const safe = await ethers.getContractAt(
      ["function isModuleEnabled(address module) external view returns (bool)"],
      addresses.multichainStrategist
    );
    expect(await safe.isModuleEnabled(pauseModule.address)).to.be.true;
  });

  it("Should have both mainnet vaults allow-listed", async () => {
    const vaultProxy = await ethers.getContract("VaultProxy");
    const oethVaultProxy = await ethers.getContract("OETHVaultProxy");

    expect(await pauseModule.isPausableTarget(vaultProxy.address)).to.be.true;
    expect(await pauseModule.isPausableTarget(oethVaultProxy.address)).to.be
      .true;
  });

  for (const [vaultName, vaultProxyName] of [
    ["OUSD", "VaultProxy"],
    ["OETH", "OETHVaultProxy"],
  ]) {
    describe(`${vaultName} vault`, () => {
      it("Should let the operator pause capital, and only the admin lift it", async () => {
        const { admin, strategist } = fixture;
        const proxy = await ethers.getContract(vaultProxyName);
        const vault = await ethers.getContractAt("IVault", proxy.address);

        expect(await vault.capitalPaused()).to.be.false;

        await pauseModule.connect(operator).pauseCapital(vault.address);
        expect(await vault.capitalPaused()).to.be.true;

        // The Safe hosting the module is the Strategist. It could trip the
        // pause, but it cannot lift it — that is the whole point.
        await expect(
          vault.connect(strategist).unpauseCapital()
        ).to.be.revertedWith("Caller is not the Admin or Governor");
        expect(await vault.capitalPaused()).to.be.true;

        await vault.connect(admin).unpauseCapital();
        expect(await vault.capitalPaused()).to.be.false;
      });

      it("Should let the operator pause rebase", async () => {
        const { admin } = fixture;
        const proxy = await ethers.getContract(vaultProxyName);
        const vault = await ethers.getContractAt("IVault", proxy.address);

        await pauseModule.connect(operator).pauseRebase(vault.address);
        expect(await vault.rebasePaused()).to.be.true;

        await vault.connect(admin).unpauseRebase();
        expect(await vault.rebasePaused()).to.be.false;
      });

      it("Should revert for a non-operator", async () => {
        const { anna } = fixture;
        const proxy = await ethers.getContract(vaultProxyName);

        await expect(
          pauseModule.connect(anna).pauseCapital(proxy.address)
        ).to.be.revertedWith("Caller is not an operator");
      });
    });
  }
});
