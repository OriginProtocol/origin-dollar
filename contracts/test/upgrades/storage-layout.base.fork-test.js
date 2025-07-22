const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const {
  assertStorageLayoutForAllProxies,
} = require("../../tasks/storageSlots");

const hre = require("hardhat");
const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Storage Layout", function () {
  beforeEach(async () => {
    // Load fixture to run deployments
    await baseFixture();
  });

  it("No proxy should have unexpected storage layout changes", async () => {
    await assertStorageLayoutForAllProxies(hre);
  });
});
