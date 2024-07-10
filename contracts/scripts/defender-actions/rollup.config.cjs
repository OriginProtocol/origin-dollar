const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const builtins = require("builtin-modules");
const { visualizer } = require("rollup-plugin-visualizer");

const commonConfig = {
  plugins: [
    resolve({ preferBuiltins: true, exportConditions: ["node"] }),
    commonjs(),
    json({ compact: true }),
    visualizer(),
  ],
  // Do not bundle these packages.
  // ethers is required to be bundled even though its an Autotask package.
  external: [
    ...builtins,
    "axios",
    "chai",
    "@openzeppelin/defender-relay-client/lib/ethers",
    "@openzeppelin/defender-sdk",
    "@openzeppelin/defender-autotask-client",
    "@openzeppelin/defender-kvstore-client",
    "@openzeppelin/defender-relay-client/lib/ethers",
    "@nomicfoundation/solidity-analyzer-darwin-arm64",
    "@nomicfoundation/solidity-analyzer-darwin-x64",
    "fsevents",
    "ethers",
    "web3",
    "mocha",
  ],
};

module.exports = [
   {
    ...commonConfig,
    input: "doAccounting.js",
    output: {
      file: "dist/doAccounting/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  { 
    ...commonConfig,
    input: "stakeValidators.js",
    output: {
      file: "dist/stakeValidators/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  {
    ...commonConfig,
    input: "registerValidators.js",
    output: {
      file: "dist/registerValidators/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
];
