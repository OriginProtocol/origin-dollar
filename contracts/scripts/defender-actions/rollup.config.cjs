const path = require("path");
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

const actions = [
  "doAccounting",
  "harvest",
  "manageBribeOnSonic",
  "managePassThrough",
  "sonicRequestWithdrawal",
  "sonicClaimWithdrawals",
  "claimBribes",
  "crossChainRelay",
];

module.exports = actions.map((action) => ({
  input: path.resolve(__dirname, `${action}.js`),
  output: {
    file: path.resolve(__dirname, `dist/${action}/index.js`),
    inlineDynamicImports: true,
    format: "cjs",
  },
  ...commonConfig,
}));
