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
    input: "harvest.js",
    output: {
      file: "dist/harvest/index.js",
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
  {
    ...commonConfig,
    input: "manageBribeOnSonic.js",
    output: {
      file: "dist/manageBribeOnSonic/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  {
    ...commonConfig,
    input: "managePassThrough.js",
    output: {
      file: "dist/managePassThrough/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  {
    ...commonConfig,
    input: "sonicRequestWithdrawal.js",
    output: {
      file: "dist/sonicRequestWithdrawal/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  {
    ...commonConfig,
    input: "sonicClaimWithdrawals.js",
    output: {
      file: "dist/sonicClaimWithdrawals/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
  {
    ...commonConfig,
    input: "claimBribes.js",
    output: {
      file: "dist/claimBribes/index.js",
      inlineDynamicImports: true,
      format: "cjs",
    },
  },
];
