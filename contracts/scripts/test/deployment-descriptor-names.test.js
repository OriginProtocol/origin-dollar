const assert = require("node:assert/strict");
const test = require("node:test");
const {
  deploymentDescriptorName,
} = require("../lib/deployment-descriptor-names");

const first = "0x1111111111111111111111111111111111111111";
const second = "0x2222222222222222222222222222222222222222";
const third = "0x3333333333333333333333333333333333333333";
const registrations = [
  { name: "OUSD_CURVE_AMO_REPEG_MODULE", implementation: first },
  { name: "OETH_CURVE_AMO_REPEG_MODULE", implementation: second },
  { name: "SUPER_OETH_CURVE_AMO_REPEG_MODULE", implementation: third },
];

test("separates multiple instances of the same repeg module into asset descriptors", () => {
  assert.equal(
    deploymentDescriptorName("CurveAmoRepegModule", first, registrations),
    "OUSDCurveAmoRepegModule"
  );
  assert.equal(
    deploymentDescriptorName("CurveAmoRepegModule", second, registrations),
    "OETHCurveAmoRepegModule"
  );
  assert.equal(
    deploymentDescriptorName("CurveAmoRepegModule", third, registrations),
    "SuperOETHCurveAmoRepegModule"
  );
});

test("does not select another asset's stale registration", () => {
  assert.throws(
    () =>
      deploymentDescriptorName(
        "CurveAmoRepegModule",
        third,
        registrations.slice(0, 2)
      ),
    /found 0/
  );
});

test("fails closed when an address is registered for two assets", () => {
  const duplicate = [
    ...registrations,
    { name: "OETH_CURVE_AMO_REPEG_MODULE", implementation: first },
  ];
  assert.throws(
    () => deploymentDescriptorName("CurveAmoRepegModule", first, duplicate),
    /found 2/
  );
});

test("unrelated deployments retain their existing descriptor names", () => {
  assert.equal(deploymentDescriptorName("OUSD", first, []), "OUSD");
});

test("matches registration addresses independent of case", () => {
  const address = "0xABcDEF1234567890abCDEF1234567890abCDEF12";
  const entries = [
    {
      name: "OUSD_CURVE_AMO_REPEG_MODULE",
      implementation: address.toLowerCase(),
    },
  ];
  assert.equal(
    deploymentDescriptorName("CurveAmoRepegModule", address, entries),
    "OUSDCurveAmoRepegModule"
  );
});

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function descriptorFixture(t, bindings = registrations) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "repeg-descriptors-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scripts = path.join(root, "scripts");
  fs.mkdirSync(path.join(scripts, "lib"), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "../create-deployment-descriptors.js"),
    path.join(scripts, "create-deployment-descriptors.js")
  );
  fs.copyFileSync(
    path.join(__dirname, "../lib/deployment-descriptor-names.js"),
    path.join(scripts, "lib/deployment-descriptor-names.js")
  );
  fs.symlinkSync(
    path.join(__dirname, "../../node_modules"),
    path.join(root, "node_modules"),
    "dir"
  );
  for (const directory of [
    "build",
    "deployments/mainnet",
    "out/CurveAmoRepegModule.sol",
    "broadcast/DeployManager.s.sol/1",
  ]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, "build/deployments-1.json"),
    JSON.stringify({ contracts: bindings })
  );
  fs.writeFileSync(
    path.join(root, "out/CurveAmoRepegModule.sol/CurveAmoRepegModule.json"),
    JSON.stringify({
      abi: [
        {
          type: "function",
          name: "nonce",
          inputs: [],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
      ],
    })
  );
  fs.writeFileSync(
    path.join(root, "broadcast/DeployManager.s.sol/1/run-latest.json"),
    JSON.stringify({
      chain: 1,
      timestamp: Date.now(),
      transactions: [first, second].map((address) => ({
        transactionType: "CREATE",
        contractName: "CurveAmoRepegModule",
        contractAddress: address,
        arguments: [
          third,
          third,
          first,
          first,
          first,
          "1000000000000000000",
          "1000000000000000000",
        ],
      })),
      receipts: [first, second].map((address) => ({
        contractAddress: address,
        status: "0x1",
      })),
    })
  );
  return root;
}

test("broadcast export writes distinct OUSD and OETH descriptors for the shared artifact", (t) => {
  const root = descriptorFixture(t);
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts/create-deployment-descriptors.js"),
      "--chain-id",
      "1",
    ],
    { encoding: "utf8" }
  );
  const directory = path.join(root, "deployments/mainnet");
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    "OETHCurveAmoRepegModule.json",
    "OUSDCurveAmoRepegModule.json",
  ]);
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(directory, "OUSDCurveAmoRepegModule.json"))
    ).address,
    first
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(directory, "OETHCurveAmoRepegModule.json"))
    ).address,
    second
  );
  const batch = JSON.parse(
    fs.readFileSync(path.join(root, "build/ousd-curve-amo-repeg-enable-1.json"))
  );
  assert.equal(batch.chainId, "1");
  assert.equal(batch.meta.createdFromSafeAddress, third);
  assert.equal(batch.transactions[0].to, third);
  assert.equal(
    batch.transactions[0].data,
    "0x610b5925" + first.slice(2).padStart(64, "0")
  );
});

test("an unbound module creation aborts export before any descriptor is written", (t) => {
  const root = descriptorFixture(t, registrations.slice(0, 1));
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/create-deployment-descriptors.js"),
          "--chain-id",
          "1",
        ],
        { encoding: "utf8", stdio: "pipe" }
      ),
    /found 0/
  );
  assert.deepEqual(fs.readdirSync(path.join(root, "deployments/mainnet")), []);
});

test("a failed creation receipt produces neither descriptors nor Safe enablement files", (t) => {
  const root = descriptorFixture(t);
  const broadcast = path.join(
    root,
    "broadcast/DeployManager.s.sol/1/run-latest.json"
  );
  const run = JSON.parse(fs.readFileSync(broadcast));
  run.receipts[0].status = "0x0";
  fs.writeFileSync(broadcast, JSON.stringify(run));
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/create-deployment-descriptors.js"),
          "--chain-id",
          "1",
        ],
        { encoding: "utf8", stdio: "pipe" }
      ),
    /No successful receipt/
  );
  assert.deepEqual(fs.readdirSync(path.join(root, "deployments/mainnet")), []);
  assert.deepEqual(fs.readdirSync(path.join(root, "build")), [
    "deployments-1.json",
  ]);
});

test("missing constructor arguments abort before writing descriptors or Safe files", (t) => {
  const root = descriptorFixture(t);
  const broadcast = path.join(
    root,
    "broadcast/DeployManager.s.sol/1/run-latest.json"
  );
  const run = JSON.parse(fs.readFileSync(broadcast));
  delete run.transactions[1].arguments;
  fs.writeFileSync(broadcast, JSON.stringify(run));
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/create-deployment-descriptors.js"),
          "--chain-id",
          "1",
        ],
        { encoding: "utf8", stdio: "pipe" }
      ),
    /Missing constructor arguments/
  );
  assert.deepEqual(fs.readdirSync(path.join(root, "deployments/mainnet")), []);
  assert.deepEqual(fs.readdirSync(path.join(root, "build")), [
    "deployments-1.json",
  ]);
});

test("dry-run validates outputs without writing descriptors or enablement files", (t) => {
  const root = descriptorFixture(t);
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts/create-deployment-descriptors.js"),
      "--chain-id",
      "1",
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.deepEqual(fs.readdirSync(path.join(root, "deployments/mainnet")), []);
  assert.deepEqual(fs.readdirSync(path.join(root, "build")), [
    "deployments-1.json",
  ]);
});

for (const [label, index, value] of [
  ["zero Safe", 0, "0x0000000000000000000000000000000000000000"],
  ["malformed binding", 3, "invalid"],
  ["zero cap", 5, "0"],
  ["negative cap", 6, "-1"],
  [
    "overflowing cap",
    5,
    "0x8000000000000000000000000000000000000000000000000000000000000000",
  ],
]) {
  test(`invalid constructor ${label} aborts before writing any output`, (t) => {
    const root = descriptorFixture(t);
    const broadcast = path.join(
      root,
      "broadcast/DeployManager.s.sol/1/run-latest.json"
    );
    const run = JSON.parse(fs.readFileSync(broadcast));
    run.transactions[1].arguments[index] = value;
    fs.writeFileSync(broadcast, JSON.stringify(run));
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/create-deployment-descriptors.js"),
          "--chain-id",
          "1",
        ],
        { encoding: "utf8", stdio: "pipe" }
      )
    );
    assert.deepEqual(
      fs.readdirSync(path.join(root, "deployments/mainnet")),
      []
    );
    assert.deepEqual(fs.readdirSync(path.join(root, "build")), [
      "deployments-1.json",
    ]);
  });
}
