const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");

describe("VaultAdmin Upgrades", async function () {
  let ousd, vault, vaultStorage, governor;

  beforeEach(async function () {
    const fixture = await loadDefaultFixture();
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    vaultStorage = await hre.ethers.getContractAt(
      "VaultStorage",
      vault.address
    );
  });

  it("should upgrade to a new admin implementation", async function () {
    const newVaultImpl = ousd.address; // ;)
    await vaultStorage.connect(governor).setAdminImpl(newVaultImpl);
  });

  it("should not upgrade to a non-contract admin implementation", async function () {
    const blankImpl = "0x4000000000000000000000000000000000000004";
    await expect(
      vaultStorage.connect(governor).setAdminImpl(blankImpl)
    ).to.be.revertedWith("new implementation is not a contract");
  });
});
