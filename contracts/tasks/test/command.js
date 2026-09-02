const assert = require("node:assert/strict");
const { coerceParams, taskHandler, parseCli } = require("../lib/command");
const deployments = require("../lib/deployments");
const { rpcUrlFor } = require("../lib/network");
const { getOptionalSigner } = require("../lib/signer");

const params = [
  {
    name: "count",
    description: "",
    type: "int",
    optional: false,
    flag: false,
    variadic: false,
  },
  {
    name: "dryrun",
    description: "",
    type: "boolean",
    optional: true,
    flag: false,
    variadic: false,
    default: false,
  },
];

describe("ops CLI parsing", function () {
  it("parses kebab-case options and coerces catalogue types", function () {
    const parsed = parseCli([
      "mine",
      "--network",
      "base",
      "--count",
      "2",
      "--dryrun",
      "true",
    ]);
    assert.deepEqual(parsed, {
      name: "mine",
      network: "base",
      flags: { count: "2", dryrun: "true" },
    });
    assert.deepEqual(coerceParams(params, parsed.flags), {
      count: 2,
      dryrun: true,
    });
  });

  it("rejects missing required, unknown, and malformed options", function () {
    assert.throws(() => coerceParams(params, {}), /--count is required/);
    assert.throws(
      () => coerceParams(params, { count: "2", surprise: true }),
      /Unknown option --surprise/
    );
    assert.throws(
      () => coerceParams(params, { count: "2.5" }),
      /must be a valid int/
    );
    assert.throws(
      () => parseCli(["mine", "unexpected"]),
      /Unexpected positional argument/
    );
  });

  it("preserves the canonical arbitrumOne network name", function () {
    const previous = process.env.ARBITRUM_PROVIDER_URL;
    process.env.ARBITRUM_PROVIDER_URL = "http://127.0.0.1:8545";
    try {
      for (const name of ["arbitrum", "arbitrumOne"]) {
        assert.deepEqual(rpcUrlFor(name), {
          chainId: 42161,
          networkName: "arbitrumOne",
          url: "http://127.0.0.1:8545",
        });
      }
    } finally {
      if (previous === undefined) delete process.env.ARBITRUM_PROVIDER_URL;
      else process.env.ARBITRUM_PROVIDER_URL = previous;
    }
  });

  it("loads only contract deployment descriptors", function () {
    const descriptors = deployments.all(1);
    assert.equal(Object.hasOwn(descriptors, ".migrations"), false);
    assert.equal(
      Object.values(descriptors).every(
        ({ address }) => typeof address === "string" && address.startsWith("0x")
      ),
      true
    );
  });

  it("allows read-only commands without signer credentials", async function () {
    const names = [
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
      "AWS_CONTAINER_CREDENTIALS_FULL_URI",
      "DEPLOYER_PK",
      "GOVERNOR_PK",
      "FORK",
      "IMPERSONATE",
    ];
    const previous = Object.fromEntries(
      names.map((name) => [name, process.env[name]])
    );
    for (const name of names) delete process.env[name];
    try {
      assert.equal(await getOptionalSigner(), undefined);
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });

  it("provides task globals only while a standalone handler runs", async function () {
    const before = {
      ethers: global.ethers,
      deployments: global.deployments,
      getNamedAccounts: global.getNamedAccounts,
      hre: global.hre,
    };
    const calls = [];
    const context = {
      chainId: 1,
      networkName: "mainnet",
      ethers: {
        getContract: async (name) => ({
          governor: async () => {
            calls.push(name);
            return "0x0000000000000000000000000000000000000001";
          },
        }),
      },
      network: { name: "mainnet", config: { chainId: 1 }, provider: {} },
      deployments: {},
      getNamedAccounts: async () => ({}),
    };

    const originalLog = console.log;
    console.log = () => {};
    try {
      await taskHandler("governors")({}, context);
    } finally {
      console.log = originalLog;
    }

    assert.deepEqual(calls, ["OUSDProxy", "VaultProxy"]);
    assert.equal(global.ethers, before.ethers);
    assert.equal(global.deployments, before.deployments);
    assert.equal(global.getNamedAccounts, before.getNamedAccounts);
    assert.equal(global.hre, before.hre);
  });
});
