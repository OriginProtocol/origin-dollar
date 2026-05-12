const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const { isCI } = require("./../helpers");
const { impersonateAndFund } = require("../../utils/signers");

describe("ForkTest: permissioned rebase", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  for (const [vaultName, vaultProxyName] of [
    ["OUSD", "VaultProxy"],
    ["OETH", "OETHVaultProxy"],
  ]) {
    describe(`${vaultName} vault`, () => {
      it("Should let the operator rebase and revert for unauthorized callers", async () => {
        const { anna } = fixture;
        const proxy = await ethers.getContract(vaultProxyName);
        const vault = await ethers.getContractAt("IVault", proxy.address);

        const operatorAddr = await vault.operatorAddr();
        // The deploy proposal sets the operator to the Talos relayer.
        expect(operatorAddr.toLowerCase()).to.equal(
          addresses.talosRelayer.toLowerCase()
        );

        const operator = await impersonateAndFund(operatorAddr);

        // Operator can rebase. lastRebase advances on yield-producing rebases;
        // we only assert success here since we don't control yield in the fork.
        const lastRebaseBefore = await vault.lastRebase();
        await vault.connect(operator).rebase();
        const lastRebaseAfter = await vault.lastRebase();
        expect(lastRebaseAfter).to.be.gte(lastRebaseBefore);

        // Random EOA call reverts with the auth error.
        await expect(vault.connect(anna).rebase()).to.be.revertedWith(
          "Caller not authorized"
        );
      });
    });
  }
});
