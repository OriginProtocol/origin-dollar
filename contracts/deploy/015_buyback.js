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

const deployName = "015_buyback_contract";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  await deployWithConfirmation("Buyback");
  const cBuyback = await ethers.getContract("Buyback");

  // Initiate transfer of 3Pool ownership to the governor.
  await withConfirmation(
    cBuyback
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`Buyback transferGovernance(${governorAddr} called`);

  // Deploy a new VaultAdmin contract.
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  // Proposal for the governor to claim governance and the strategy to be
  // approved on the Vault
  const propDescription = "Deploy and integrate Buyback contract";
  const propArgs = await proposeArgs([
    {
      contract: cVaultProxy,
      signature: "setAdminImpl(address)",
      args: [dVaultCore.address],
    },
    {
      contract: cBuyback,
      signature: "claimGovernance()",
    },
    {
      contract: cVaultAdmin,
      signature: "setTrusteeAddress(address)",
      args: [cBuyback.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually
    // via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute
    // it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined
    // reason...
    const gasLimit = isRinkeby ? 1000000 : null;
    await withConfirmation(
      cVaultProxy.connect(sGovernor).setAdminImpl(dVaultCore.address)
    );
    log("Upgrade Vault admin implementation");
    await withConfirmation(
      cBuyback.connect(sGovernor).claimGovernance(await getTxOpts(gasLimit))
    );
    log("Claimed governance of Buyback");
    await withConfirmation(
      cVaultAdmin.connect(sGovernor).setTrusteeAddress(cBuyback.address)
    );
    log("Set trustee address to Buyback");
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
main.dependencies = ["013_trustee"];
main.skip = () => !(isMainnet || isRinkeby || isFork) || isSmokeTest;

module.exports = main;
