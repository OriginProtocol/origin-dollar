const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const {
  isGanacheFork,
  oracleUnits,
  loadFixture,
  advanceTime,
} = require("./helpers");

const DAY = 24 * 60 * 60;

function prepareForTimelock(tx, eta) {
  const target = tx.to;
  const value = 0;
  const signature = tx.data.slice(0, 10);
  const data = "0x" + tx.data.slice(10);
  return { target, value, signature, data, eta };
}

describe("Timelock controls oracle", function () {
  let timelock, oracle, anna, governor;
  let timelockData;

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
    const tx = await oracle.populateTransaction.setPrice(
      "DAI",
      oracleUnits("1.02")
    );
    const eta = Math.floor(new Date() / 1000 + 4 * DAY);
    timelockData = prepareForTimelock(tx, eta);
    timelockData.signature = "setPrice(string,uint256)";
  });

  it("Should not have changed the oracle price", async () => {
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.32"));
  });

  it("Should add the transaction to the queue", async () => {
    await timelock
      .connect(governor)
      .queueTransaction(
        timelockData.target,
        timelockData.value,
        timelockData.signature,
        timelockData.data,
        timelockData.eta
      );
  });

  it("Should not be able to execute the transaction", async () => {
    await expect(
      timelock
        .connect(governor)
        .executeTransaction(
          timelockData.target,
          timelockData.value,
          timelockData.signature,
          timelockData.data,
          timelockData.eta
        )
    ).to.be.reverted;
  });

  it("Should execute the transaction after three days", async () => {
    advanceTime(4 * DAY);
    await timelock
      .connect(governor)
      .executeTransaction(
        timelockData.target,
        timelockData.value,
        timelockData.signature,
        timelockData.data,
        timelockData.eta
      );
  });

  it("Should have changed the oracle price", async () => {
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
  });
});
