const { createFixtureLoader } = require("../_fixture");
const { defaultFixture } = require("../_fixture");
const {
  assertStorageLayoutForAllProxies,
} = require("../../tasks/storageSlots");

const hre = require("hardhat");
const loadFixture = createFixtureLoader(defaultFixture);

describe("ForkTest: Storage Layout", function () {
  beforeEach(async () => {
    // Load fixture to run deployments
    await loadFixture();
  });

  it("No proxy should have unexpected storage layout changes", async () => {
    await assertStorageLayoutForAllProxies(hre);
  });
});
