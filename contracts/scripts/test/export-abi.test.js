const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { exportAbiPackage, hardhatArtifactFromForge } = require("../export-abi");

const forgeArtifact = ({
  contractName = "Example",
  sourceName = "contracts/Example.sol",
  abi = [{ type: "function", name: "value", inputs: [], outputs: [] }],
} = {}) => ({
  abi,
  bytecode: {
    object: "0x6000",
    linkReferences: { "contracts/Library.sol": { Library: [] } },
  },
  deployedBytecode: {
    object: "0x6001",
    linkReferences: {},
  },
  metadata: {
    settings: { compilationTarget: { [sourceName]: contractName } },
  },
});

function writeArtifact(outDir, sourceFile, contractName, artifact) {
  const dir = path.join(outDir, sourceFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${contractName}.json`),
    JSON.stringify(artifact)
  );
}

test("converts a Forge artifact to the public Hardhat artifact shape", () => {
  assert.deepEqual(hardhatArtifactFromForge(forgeArtifact()), {
    _format: "hh-sol-artifact-1",
    contractName: "Example",
    sourceName: "contracts/Example.sol",
    abi: [{ type: "function", name: "value", inputs: [], outputs: [] }],
    bytecode: "0x6000",
    deployedBytecode: "0x6001",
    linkReferences: { "contracts/Library.sol": { Library: [] } },
    deployedLinkReferences: {},
  });
});

test("exports only production contracts and copies package metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "origin-abi-"));
  const outDir = path.join(root, "out");
  const distDir = path.join(root, "dist");
  const packageFile = path.join(root, "abi.package.json");
  const npmrcFile = path.join(root, ".npmrc.abi");

  writeArtifact(outDir, "Example.sol", "Example", forgeArtifact());
  writeArtifact(
    outDir,
    "MockThing.sol",
    "MockThing",
    forgeArtifact({
      contractName: "MockThing",
      sourceName: "contracts/MockThing.sol",
    })
  );
  writeArtifact(
    outDir,
    "Dependency.sol",
    "Dependency",
    forgeArtifact({
      contractName: "Dependency",
      sourceName: "dependencies/example/Dependency.sol",
    })
  );
  fs.writeFileSync(
    packageFile,
    JSON.stringify({ name: "@origin/defi", version: "RELEASE_VERSION" })
  );
  fs.writeFileSync(npmrcFile, "provenance=true\n");

  const result = exportAbiPackage({ outDir, distDir, packageFile, npmrcFile });

  assert.deepEqual(result, { exported: 1, skippedMocks: 1 });
  assert.deepEqual(fs.readdirSync(path.join(distDir, "abi")), ["Example.json"]);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(distDir, "package.json"))).name,
    "@origin/defi"
  );
  assert.equal(
    fs.readFileSync(path.join(distDir, ".npmrc"), "utf8"),
    "provenance=true\n"
  );
});

test("fails closed on an unconfigured duplicate contract name", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "origin-abi-"));
  const outDir = path.join(root, "out");
  const distDir = path.join(root, "dist");
  const packageFile = path.join(root, "abi.package.json");
  const npmrcFile = path.join(root, ".npmrc.abi");

  writeArtifact(
    outDir,
    "One.sol",
    "Duplicate",
    forgeArtifact({
      contractName: "Duplicate",
      sourceName: "contracts/One.sol",
    })
  );
  writeArtifact(
    outDir,
    "Two.sol",
    "Duplicate",
    forgeArtifact({
      contractName: "Duplicate",
      sourceName: "contracts/Two.sol",
    })
  );
  fs.writeFileSync(packageFile, "{}");
  fs.writeFileSync(npmrcFile, "");

  assert.throws(
    () => exportAbiPackage({ outDir, distDir, packageFile, npmrcFile }),
    /Duplicate contract name "Duplicate"/
  );
});

test("preserves the published source for a configured duplicate name", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "origin-abi-"));
  const outDir = path.join(root, "out");
  const distDir = path.join(root, "dist");
  const packageFile = path.join(root, "abi.package.json");
  const npmrcFile = path.join(root, ".npmrc.abi");

  writeArtifact(
    outDir,
    "MockAMOStrategy.sol",
    "IOToken",
    forgeArtifact({
      contractName: "IOToken",
      sourceName: "contracts/mocks/MockAMOStrategy.sol",
      abi: [{ type: "function", name: "minimal", inputs: [], outputs: [] }],
    })
  );
  writeArtifact(
    outDir,
    "IOToken.sol",
    "IOToken",
    forgeArtifact({
      contractName: "IOToken",
      sourceName: "contracts/interfaces/IOToken.sol",
      abi: [{ type: "function", name: "canonical", inputs: [], outputs: [] }],
    })
  );
  fs.writeFileSync(packageFile, "{}");
  fs.writeFileSync(npmrcFile, "");

  exportAbiPackage({ outDir, distDir, packageFile, npmrcFile });

  const exported = JSON.parse(
    fs.readFileSync(path.join(distDir, "abi", "IOToken.json"), "utf8")
  );
  assert.equal(exported.sourceName, "contracts/interfaces/IOToken.sol");
  assert.equal(exported.abi[0].name, "canonical");
});

test("fails if only the non-published source of a configured duplicate remains", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "origin-abi-"));
  const outDir = path.join(root, "out");
  const distDir = path.join(root, "dist");
  const packageFile = path.join(root, "abi.package.json");
  const npmrcFile = path.join(root, ".npmrc.abi");

  writeArtifact(
    outDir,
    "MockAMOStrategy.sol",
    "IOToken",
    forgeArtifact({
      contractName: "IOToken",
      sourceName: "contracts/mocks/MockAMOStrategy.sol",
    })
  );
  fs.writeFileSync(packageFile, "{}");
  fs.writeFileSync(npmrcFile, "");

  assert.throws(
    () => exportAbiPackage({ outDir, distDir, packageFile, npmrcFile }),
    /Preferred source contracts\/interfaces\/IOToken.sol not found/
  );
});
