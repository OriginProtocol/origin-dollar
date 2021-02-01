const {
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "013_flash_thief";


const upgrades = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const ousdProxy = await ethers.getContract("OUSDProxy");

  // Deploy a new CompoundStrategy contract.
  const flashThiefd = await deployWithConfirmation(
    "FlashThief",
    [ousdProxy.address, vaultProxy.address]
  );

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await upgrades(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["011_ousd_fix"];
main.skip = () => !(isMainnet || isFork || isRinkeby);

module.exports = main;
