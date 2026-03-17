const hre = require("hardhat");
const { ethers } = hre;
const mocha = require("mocha");
const { isFork, isHyperEVMFork } = require("./helpers");
const { impersonateAndFund } = require("../utils/signers");
const { nodeRevert, nodeSnapshot } = require("./_fixture");
const addresses = require("../utils/addresses");

let snapshotId;

const defaultFixture = async () => {
  if (!snapshotId && !isFork) {
    snapshotId = await nodeSnapshot();
  }

  if (!isHyperEVMFork && isFork) {
    // Only works for HyperEVM fork
    return;
  }

  const { deployerAddr } = await getNamedAccounts();

  if (isFork) {
    await impersonateAndFund(deployerAddr);
  }

  await deployments.fixture(["hyperevm"], {
    keepExistingDeployments: true,
    fallbackToGlobal: true,
  });

  const { timelockAddr, multichainStrategistAddr } = await getNamedAccounts();

  const admin = await impersonateAndFund(addresses.hyperevm.admin);
  admin.address = addresses.hyperevm.admin;

  const strategist = await impersonateAndFund(multichainStrategistAddr);
  strategist.address = multichainStrategistAddr;

  const timelock = await ethers.getContractAt(
    "ITimelockController",
    timelockAddr
  );

  if (isFork) {
    await impersonateAndFund(timelockAddr);
  }

  const crossChainRemoteStrategy = await ethers.getContractAt(
    "CrossChainRemoteStrategy",
    addresses.hyperevm.CrossChainRemoteStrategy
  );

  return {
    admin,
    strategist,
    timelock,
    crossChainRemoteStrategy,
  };
};

const defaultHyperEVMFixture = deployments.createFixture(defaultFixture);

mocha.after(async () => {
  if (snapshotId) {
    await nodeRevert(snapshotId);
  }
});

module.exports = {
  defaultHyperEVMFixture,
};
