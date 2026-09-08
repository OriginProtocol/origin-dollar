#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// The legacy package flattened artifacts by contract name. These two names are
// declared in multiple production sources; preserve the exact source selected
// by the previously published package.
const PREFERRED_SOURCES = {
  ICurvePoolBooster: "contracts/automation/CurvePoolBoosterBribesModule.sol",
  IOToken: "contracts/interfaces/IOToken.sol",
};

function compilationTarget(artifact) {
  const targets = artifact?.metadata?.settings?.compilationTarget;
  const entries = targets ? Object.entries(targets) : [];
  if (entries.length !== 1) return null;
  const [[sourceName, contractName]] = entries;
  return { sourceName, contractName };
}

function bytecodeObject(value) {
  if (!value) return "0x";
  return typeof value === "string" ? value : value.object || "0x";
}

function linkReferences(value) {
  return value && typeof value === "object" ? value.linkReferences || {} : {};
}

function publicArtifactFromForge(artifact) {
  const target = compilationTarget(artifact);
  if (!target) {
    throw new Error("Forge artifact has no unique compilation target");
  }

  return {
    _format: "hh-sol-artifact-1",
    contractName: target.contractName,
    sourceName: target.sourceName,
    abi: artifact.abi || [],
    bytecode: bytecodeObject(artifact.bytecode),
    deployedBytecode: bytecodeObject(artifact.deployedBytecode),
    linkReferences: linkReferences(artifact.bytecode),
    deployedLinkReferences: linkReferences(artifact.deployedBytecode),
  };
}

function jsonFiles(root) {
  if (!fs.existsSync(root)) {
    throw new Error(`Forge output not found at ${root}; run forge build first`);
  }

  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        files.push(absolute);
    }
  };
  visit(root);
  return files.sort();
}

function selectArtifacts(outDir) {
  const byName = new Map();
  let skippedMocks = 0;

  for (const artifactPath of jsonFiles(outDir)) {
    let artifact;
    try {
      artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    } catch {
      continue;
    }

    const target = compilationTarget(artifact);
    if (!target || !target.sourceName.startsWith("contracts/")) continue;
    if (target.contractName.startsWith("Mock")) {
      skippedMocks += 1;
      continue;
    }

    const candidate = { artifact, artifactPath, ...target };
    const existing = byName.get(target.contractName);
    if (!existing) {
      byName.set(target.contractName, candidate);
      continue;
    }

    const preferredSource = PREFERRED_SOURCES[target.contractName];
    if (!preferredSource) {
      throw new Error(
        `Duplicate contract name "${target.contractName}" in ${existing.sourceName} and ${target.sourceName}`
      );
    }

    if (target.sourceName === preferredSource) {
      byName.set(target.contractName, candidate);
    } else if (existing.sourceName !== preferredSource) {
      throw new Error(
        `Preferred source ${preferredSource} not found for duplicate contract "${target.contractName}"`
      );
    }
  }

  for (const [contractName, preferredSource] of Object.entries(
    PREFERRED_SOURCES
  )) {
    const selected = byName.get(contractName);
    if (selected && selected.sourceName !== preferredSource) {
      throw new Error(
        `Preferred source ${preferredSource} not found for duplicate contract "${contractName}"`
      );
    }
  }

  return { artifacts: byName, skippedMocks };
}

function exportAbiPackage({ outDir, distDir, packageFile, npmrcFile }) {
  const { artifacts, skippedMocks } = selectArtifacts(outDir);
  const abiDir = path.join(distDir, "abi");

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(abiDir, { recursive: true });

  for (const contractName of [...artifacts.keys()].sort()) {
    const { artifact } = artifacts.get(contractName);
    const exported = publicArtifactFromForge(artifact);
    fs.writeFileSync(
      path.join(abiDir, `${contractName}.json`),
      `${JSON.stringify(exported, null, 2)}\n`
    );
  }

  fs.copyFileSync(packageFile, path.join(distDir, "package.json"));
  fs.copyFileSync(npmrcFile, path.join(distDir, ".npmrc"));

  return { exported: artifacts.size, skippedMocks };
}

function main() {
  const contractsRoot = path.join(__dirname, "..");
  const result = exportAbiPackage({
    outDir: path.join(contractsRoot, "out"),
    distDir: path.join(contractsRoot, "dist"),
    packageFile: path.join(contractsRoot, "abi.package.json"),
    npmrcFile: path.join(contractsRoot, ".npmrc.abi"),
  });
  console.log(
    `Exported ${result.exported} production ABI artifacts from Forge (${result.skippedMocks} mocks skipped)`
  );
}

if (require.main === module) main();

module.exports = {
  exportAbiPackage,
  publicArtifactFromForge,
  selectArtifacts,
};
