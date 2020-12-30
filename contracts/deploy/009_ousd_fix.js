const hre = require("hardhat");

const {
  isMainnet,
  isFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "009_ousd_fix";

const fixOUSD = async () => {
  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Temporary OUSD for running a reset
  const dOUSDReset = await deployWithConfirmation("OUSDReset");
  // Main OUSD
  const dOUSD = await deployWithConfirmation("OUSD");

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSDReset = await ethers.getContractAt(
    "OUSDReset",
    cOUSDProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // Proposal for the new governor to:
  // - upgradeTo OUSDReset
  // - call reset()
  // - upgradeTo OUSD
  const propResetDescription = "OUSD Reset";
  const propResetArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSDReset.address],
    },
    {
      contract: cOUSDReset,
      signature: "reset()",
    },
    {
      contract: cOUSDReset,
      signature: "setVaultAddress(address)",
      args: [cVaultProxy.address],
    },
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSD.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet claiming governance has to be handled manually via a multi-sig tx.
    log(
      "Next step: propose, enqueue and execute the following governance proposals:"
    );
    await executeProposal(propResetArgs, propResetDescription);
  } else if (isFork) {
    await executeProposal(propResetArgs, propResetDescription);
  } else {
    await withConfirmation(
      cOUSDProxy
        .connect(sGovernor)
        .upgradeTo(dOUSDReset.address, await getTxOpts())
    );
    log("Upgraded OUSD to reset implementation");

    await withConfirmation(
      cOUSDReset
        .connect(sGovernor)
        .setVaultAddress(cVaultProxy.address, await getTxOpts())
    );
    await withConfirmation(cOUSDReset.connect(sGovernor).reset());
    log("Called reset on OUSD");

    await withConfirmation(
      cOUSDProxy.connect(sGovernor).upgradeTo(dOUSD.address, await getTxOpts())
    );
    log("Upgraded OUSD to standard implementation");
  }
};

const main = async () => {
  console.log(`Running ${deployName} deployment...`);
  await fixOUSD();
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["002_upgrade_vault", "003_governor", "008_ousd_reset"];
main.skip = () => !isMainnetOrRinkebyOrFork;

module.exports = main;
