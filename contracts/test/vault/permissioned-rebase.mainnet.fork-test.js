const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const { isCI, advanceTime } = require("./../helpers");
const { impersonateAndFund } = require("../../utils/signers");

describe("ForkTest: permissioned + throttled rebase", function () {
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
      it("Should let the operator bypass the throttle and throttle public callers", async () => {
        const { anna } = fixture;
        const proxy = await ethers.getContract(vaultProxyName);
        const vault = await ethers.getContractAt("IVault", proxy.address);

        const operatorAddr = await vault.operatorAddr();
        // The deploy proposal sets the operator to the multichain strategist Safe.
        expect(operatorAddr.toLowerCase()).to.equal(
          addresses.multichainStrategist.toLowerCase()
        );

        const interval = await vault.minRebaseInterval();
        expect(interval).to.equal(86400);

        const operator = await impersonateAndFund(operatorAddr);

        // First call as operator. After this, lastRebaseTime reflects current time.
        await vault.connect(operator).rebase();
        const lastRebaseTimeAfterFirst = await vault.lastRebaseTime();

        // Random EOA call within the throttle window — silent no-op.
        await vault.connect(anna).rebase();
        expect(await vault.lastRebaseTime()).to.equal(lastRebaseTimeAfterFirst);

        // Operator call within the throttle window — bypasses throttle.
        await vault.connect(operator).rebase();
        expect(await vault.lastRebaseTime()).to.be.gt(lastRebaseTimeAfterFirst);
        const lastRebaseTimeAfterSecond = await vault.lastRebaseTime();

        // After the interval elapses, a public caller can rebase too.
        await advanceTime(interval.toNumber() + 60);
        await vault.connect(anna).rebase();
        expect(await vault.lastRebaseTime()).to.be.gt(
          lastRebaseTimeAfterSecond
        );
      });
    });
  }
});
