const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const {
  isGanacheFork,
  oracleUnits,
  loadFixture,
  advanceTime,
} = require("./helpers");

const DAY = 24 * 60 * 60;

async function timelockArgs({ contract, value = 0, signature, args, eta }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10) ;
  return [tx.to, value, signature, data, eta];
}

describe("Timelock controls mockOracle", function () {
  let timelock, oracle, anna, governor;
  let args;

  before(async () => {
    const fixture = await loadFixture(defaultFixture);
    timelock = fixture.timelock;
    oracle = fixture.mockOracle;
    governor = fixture.governor;
    anna = fixture.anna;
  });

  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should set the oracle price to a known price", async () => {
    await oracle.setPrice("DAI", oracleUnits("1.32"));
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.32"));
  });

  it("Should prepare a transaction for the timelock to execute", async () => {
    const eta = Math.floor(new Date() / 1000 + 2.1 * DAY);
    args = await timelockArgs({
      contract: oracle,
      signature: "setPrice(string,uint256)",
      args: ["DAI", oracleUnits("1.02")],
      eta,
    });
  });

  it("Should not have changed the oracle price", async () => {
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.32"));
  });

  it("Should add the transaction to the queue", async () => {
    await timelock.connect(governor).queueTransaction(...args);
  });

  it("Should not be able to execute the transaction", async () => {
    const tx = timelock.connect(governor).executeTransaction(...args);
    await expect(tx).to.be.reverted;
  });

  it("Anyone can execute the transaction after two days", async () => {
    advanceTime(2.2 * DAY);
    await timelock.connect(anna).executeTransaction(...args);
  });

  it("Should have changed the oracle price", async () => {
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
  });
});

describe("Timelock can instantly pause deposits", () => {
  let timelock, vault, governor, anna;

  before(async () => {
    const fixture = await loadFixture(defaultFixture);
    timelock = fixture.timelock;
    vault = fixture.vault;
    governor = fixture.governor;
    anna = fixture.anna;
    // Vault is governance is transfered to the timelock
    await vault.connect(governor).transferGovernance(timelock.address);

    //actually claim the governance
    const eta = Math.floor(new Date() / 1000 + 2.1 * DAY);
    const claimArgs = await timelockArgs({
      contract: vault,
      signature: "claimGovernance()",
      args: [],
      eta,
    });


    await timelock.connect(governor).queueTransaction(...claimArgs);
    advanceTime(2.2 * DAY);
    await timelock.connect(anna).executeTransaction(...claimArgs);
  });

  it("Should allow pausing deposits immediately", async () => {
    await timelock.connect(governor).unpauseDeposits(vault.address);
    await timelock.connect(governor).pauseDeposits(vault.address);
    expect(await vault.depositPaused()).to.be.true;
  });

  it("Should allow unpausing deposits immediately", async () => {
    await timelock.connect(governor).pauseDeposits(vault.address);
    await timelock.connect(governor).unpauseDeposits(vault.address);
    expect(await vault.depositPaused()).to.be.false;
  });

  it("Should not allow a non-admin to pause deposits", async () => {
    await expect(
      timelock.connect(anna).pauseDeposits(vault.address)
    ).to.be.revertedWith("Timelock::pauseDeposits: Call must come from admin.");
  });

  it("Should not allow a non-admin to unpause deposits", async () => {
    await expect(
      timelock.connect(anna).unpauseDeposits(vault.address)
    ).to.be.revertedWith(
      "Timelock::unpauseDeposits: Call must come from admin."
    );
  });
});
