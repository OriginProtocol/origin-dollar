const { isMainnet, isFork, isSmokeTest } = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "012_upgrades";

/**
 * Deploys an upgrade for the following contracts:
 *  - OUSD
 *  - VaultAdmin
 *  - Compound Strategy
 * @returns {Promise<boolean>}
 */
const upgrades = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultCoreProxy = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  // Deploy a new OUSD contract.
  const dOUSD = await deployWithConfirmation("OUSD");

  // Deploy a new VaultAdmin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  // Deploy a new CompoundStrategy contract.
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");

  // Proposal for the governor to do the upgrades.
  const propDescription = "OUSD, VaultAdmin, CompoundStrategy upgrades";
  const propArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSD.address],
    },
    {
      contract: cVaultCoreProxy,
      signature: "setAdminImpl(address)",
      args: [dVaultAdmin.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dCompoundStrategy.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    await withConfirmation(
      cOUSDProxy.connect(sGovernor).upgradeTo(dOUSD.address, await getTxOpts())
    );
    log("Upgraded OUSD to new implementation");

    await withConfirmation(
      cVaultCoreProxy
        .connect(sGovernor)
        .setAdminImpl(dVaultAdmin.address, await getTxOpts())
    );
    log("Upgraded VaultAdmin to new implementation");

    await withConfirmation(
      cCompoundStrategyProxy
        .connect(sGovernor)
        .upgradeTo(dCompoundStrategy.address, await getTxOpts())
    );
    log("Upgraded CompoundStrategy to new implementation");
  }

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
main.skip = () => !isMainnet || isSmokeTest || isFork;

module.exports = main;
