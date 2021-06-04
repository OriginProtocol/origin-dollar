const {
  isMainnet,
  isFork,
  isRinkeby,
  isSmokeTest,
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

const deployName = "018_vault_upgrade";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // Deploy Updated vault core strategy.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  // Proposal for the governor update the contract
  const propDescription = "Update vault implementation";
  const propArgs = await proposeArgs([
    {
      contract: cVaultProxy,
      signature: "upgradeTo(address)",
      args: [dVaultCore.address],
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
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;
    await withConfirmation(
      cVaultProxy
        .connect(sGovernor)
        .upgradeTo(dVaultCore.address, await getTxOpts(gasLimit))
    );
    log("Switched implementation of Vault");
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await runDeployment(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["017_3pool_strategy_update"];
main.skip = () => !(isMainnet || isRinkeby || isFork) || isSmokeTest;

module.exports = main;
