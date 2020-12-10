//
// Deploy OUSD v2 contracts
//
const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
  isGanacheFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");
const { utils } = require("ethers");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

const deployName = "007_ousdv2";

const ousdV2 = async ({ getNamedAccounts, deployments }) => {
  console.log(`Running ${deployName} deployment...`);

  // TODO

  console.log(`${deployName} deployment done.`);
  return true;
};

ousdV2.id = deployName;
ousdV2.dependencies = ["core"];

module.exports = ousdV2;
