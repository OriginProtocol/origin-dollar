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
  const data = "0x" + tx.data.slice(10);
  return [tx.to, value, signature, data, eta];
}

describe("Timelock controls oracle", function () {
  let timelock, oracle, anna, governor;
  let args;

  before(async () => {
    const fixture = await loadFixture(defaultFixture);
    timelock = fixture.timelock;
    oracle = fixture.oracle;
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
    const eta = Math.floor(new Date() / 1000 + 4 * DAY);
    args = await timelockArgs({
      contract: oracle,
      signature: "setPrice(string,uint256)",
      args: ["DAI", oracleUnits("1.02")],
      eta: Math.floor(new Date() / 1000 + 4 * DAY),
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

  it("Should execute the transaction after three days", async () => {
    advanceTime(4 * DAY);
    await timelock.connect(governor).executeTransaction(...args);
  });

  it("Should have changed the oracle price", async () => {
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
  });
});
