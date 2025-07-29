const { createFixtureLoader } = require("../_fixture");
const { defaultPlumeFixture } = require("../_fixture-plume");
const {
  assertStorageLayoutForAllProxies,
} = require("../../tasks/storageSlots");

const hre = require("hardhat");
const plumeFixture = createFixtureLoader(defaultPlumeFixture);

describe("ForkTest: Storage Layout", function () {
  beforeEach(async () => {
    // Load fixture to run deployments
    await plumeFixture();
  });

  it("No proxy should have unexpected storage layout changes", async () => {
    await assertStorageLayoutForAllProxies(hre);
  });
});
