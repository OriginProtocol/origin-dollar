const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, yearnCrossChainFixture } = require("../../_fixture");

describe.only("Yearn V3 Cross Chain Strategy", function () {
  let fixture;
  const loadFixture = createFixtureLoader(yearnCrossChainFixture);

  let yearnMasterStrategy, yearnSlaveStrategy;

  beforeEach(async function () {
    fixture = await loadFixture();
    yearnMasterStrategy = fixture.yearnMasterStrategy;
    yearnSlaveStrategy = fixture.yearnSlaveStrategy;
  });

  it("Should have correct initial state", async function () {
    expect(await yearnMasterStrategy._slaveAddress()).to.equal(yearnSlaveStrategy.address);
    expect(await yearnSlaveStrategy._masterAddress()).to.equal(yearnMasterStrategy.address);
  });
});