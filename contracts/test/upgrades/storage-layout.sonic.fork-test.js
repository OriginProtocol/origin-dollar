const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const {
  assertStorageLayoutForAllProxies,
} = require("../../tasks/storageSlots");

const hre = require("hardhat");
const loadFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Storage Layout", function () {
  beforeEach(async () => {
    // Load fixture to run deployments
    await loadFixture();
  });

  it("No proxy should have unexpected storage layout changes", async () => {
    await assertStorageLayoutForAllProxies(hre);
  });
});
