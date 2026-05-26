#!/usr/bin/env node
/**
 * Dump the sibling's hardhat task registry as a JSON catalog the Talos
 * admin UI can intersect with its global EDITABLE_FLAGS whitelist.
 *
 * Invoked at sibling-image build time (Node, not bun): the runner's bun
 * parent process cannot load hardhat directly — keccak's native module
 * uses libuv functions bun doesn't implement (oven-sh/bun#18546). Hardhat
 * stays in Node-land here; the bundled JSON is shipped into the image
 * and read by `runner.ts` at boot.
 *
 * Output shape matches `ActionParam[]` from `@talos/client/actions-catalog`.
 * Self-contained on purpose — no @talos/client import (the bundle is ESM
 * and this script runs under Node CJS).
 */

const hre = require("hardhat");

function camelToKebab(s) {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function normalizeType(name) {
  return ["string", "int", "float", "boolean"].includes(name)
    ? name
    : "unknown";
}

function normalizeDefault(v) {
  if (v === undefined) return { hasDefault: false, defaultValue: null };
  if (v === null) return { hasDefault: true, defaultValue: null };
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  ) {
    return { hasDefault: true, defaultValue: v };
  }
  return { hasDefault: true, defaultValue: null };
}

const catalog = {};
for (const [taskName, def] of Object.entries(hre.tasks)) {
  const params = [];
  const pd = def.paramDefinitions || {};
  for (const p of Object.values(pd)) {
    const { hasDefault, defaultValue } = normalizeDefault(p.defaultValue);
    params.push({
      paramName: p.name,
      cliFlag: `--${camelToKebab(p.name)}`,
      description: p.description || "",
      type: normalizeType(p.type?.name),
      isOptional: p.isOptional !== false,
      isFlag: !!p.isFlag,
      hasDefault,
      defaultValue,
    });
  }
  catalog[taskName] = params;
}

process.stdout.write(JSON.stringify(catalog));
