const assert = require("node:assert/strict");
const { initNetwork } = require("../lib/network");

const helperPath = require.resolve("../../utils/runtime-helpers");

describe("runtime helpers", function () {
  const originalFork = process.env.FORK;
  const originalRpc = process.env.MAINNET_PROVIDER_URL;

  before(function () {
    process.env.MAINNET_PROVIDER_URL = "http://127.0.0.1:8545";
    initNetwork("mainnet");
  });

  after(function () {
    if (originalRpc === undefined) delete process.env.MAINNET_PROVIDER_URL;
    else process.env.MAINNET_PROVIDER_URL = originalRpc;
  });

  afterEach(function () {
    if (originalFork === undefined) delete process.env.FORK;
    else process.env.FORK = originalFork;
    delete require.cache[helperPath];
  });

  it("distinguishes a mainnet fork from live mainnet", function () {
    process.env.FORK = "true";
    delete require.cache[helperPath];
    assert.deepEqual(require(helperPath), {
      isFork: true,
      isMainnet: false,
    });

    delete process.env.FORK;
    delete require.cache[helperPath];
    assert.deepEqual(require(helperPath), {
      isFork: false,
      isMainnet: true,
    });
  });
});