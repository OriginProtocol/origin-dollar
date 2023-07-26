const { isMainnet, isFork } = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "011_ousd_fix";

const fixOUSD = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cOUSDProxy = await ethers.getContract("OUSDProxy");

  // Deploy new OUSD contract
  const dOUSD = await deployWithConfirmation("OUSD");

  // Proposal for the governor to upgrade OUSD.
  const propDescription = "OUSD fix";
  const propArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "upgradeTo(address)",
      args: [dOUSD.address],
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
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await fixOUSD(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["002_upgrade_vault", "003_governor", "008_ousd_reset"];
main.skip = () => !isMainnet || isFork;

module.exports = main;
