const assert = require("node:assert/strict");
const { initNetwork } = require("../lib/network");
const { replaceContractAt } = require("../../utils/hardhat");

describe("replaceContractAt", function () {
  const originalRpc = process.env.MAINNET_PROVIDER_URL;

  before(function () {
    process.env.MAINNET_PROVIDER_URL = "http://127.0.0.1:8545";
  });

  after(function () {
    if (originalRpc === undefined) delete process.env.MAINNET_PROVIDER_URL;
    else process.env.MAINNET_PROVIDER_URL = originalRpc;
  });

  it("copies the mock bytecode over the target through the standalone provider", async function () {
    const { provider } = initNetwork("mainnet");
    const sent = [];
    provider.getCode = async (address) => `0x60016002:${address}`;
    provider.send = async (method, params) => {
      sent.push({ method, params });
      return null;
    };

    await replaceContractAt("0x000000000000000000000000000000000000dEaD", {
      address: "0x00000000000000000000000000000000000000A1",
    });

    assert.deepEqual(sent, [
      {
        method: "hardhat_setCode",
        params: [
          "0x000000000000000000000000000000000000dEaD",
          "0x60016002:0x00000000000000000000000000000000000000A1",
        ],
      },
    ]);
  });
});
