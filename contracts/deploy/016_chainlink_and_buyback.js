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

const deployName = "016_chainlink_and_buyback";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  // Contracts
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultCoreProxy = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );

  // Deploy a new VaultCore contract
  const dVaultCore = await deployWithConfirmation("VaultCore");

  // Deploy a new VaultAdmin contract
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  // Deploy the Buyback contract.
  await deployWithConfirmation("Buyback");
  const cBuyback = await ethers.getContract("Buyback");

  // Initiate transfer of Buyback governance to the governor
  await withConfirmation(
    cBuyback
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`Buyback transferGovernance(${governorAddr} called`);

  // Deploy OracleRouter
  await deployWithConfirmation("OracleRouter");
  const cOracleRouter = await ethers.getContract("OracleRouter");

  // Proposal to:
  // - Upgrade VaultAdmin
  // - Upgrade VaultCore
  // - Claim Governance on the Buyback contract
  // - Set the trustee address to the Buyback contract
  // - Set the price provider to the OracleRouter contract
  const propDescription = "Deploy and integrate Buyback contract";
  const propArgs = await proposeArgs([
    {
      contract: cVaultCoreProxy,
      signature: "setAdminImpl(address)",
      args: [dVaultAdmin.address],
    },
    {
      contract: cVaultProxy,
      signature: "upgradeTo(address)",
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
    {
      contract: cVaultAdmin,
      signature: "setPriceProvider(address)",
      args: [cOracleRouter.address],
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
      cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
    );
    log("Upgrade VaultCore implementation");
    await withConfirmation(
      cBuyback.connect(sGovernor).claimGovernance(await getTxOpts(gasLimit))
    );
    log("Claimed governance of Buyback contract");
    await withConfirmation(
      cVaultAdmin.connect(sGovernor).setTrusteeAddress(cBuyback.address)
    );
    log("Set trustee address to Buyback contract");
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
main.dependencies = ["015_flipper"];
main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;

module.exports = main;
