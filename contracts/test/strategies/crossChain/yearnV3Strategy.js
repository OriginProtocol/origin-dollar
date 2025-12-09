const { expect } = require("chai");
const { utils } = require("ethers");

const {
  createFixtureLoader,
  yearnCrossChainFixture,
} = require("../../_fixture");

describe.only("Yearn V3 Cross Chain Strategy", function () {
  let fixture;
  const loadFixture = createFixtureLoader(yearnCrossChainFixture);

  let yearnMasterStrategy, yearnRemoteStrategy;

  beforeEach(async function () {
    fixture = await loadFixture();
    yearnMasterStrategy = fixture.yearnMasterStrategy;
    yearnRemoteStrategy = fixture.yearnRemoteStrategy;
  });

  it("Should have correct initial state", async function () {
    expect(await yearnMasterStrategy._remoteAddress()).to.equal(
      yearnRemoteStrategy.address
    );
    expect(await yearnRemoteStrategy._masterAddress()).to.equal(
      yearnMasterStrategy.address
    );
  });
});
