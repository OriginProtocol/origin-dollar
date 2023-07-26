// 1. Deploy the latest governor contract and sets its ownership to the new multisig safe wallet.
// 2. Submit a proposal on the old governor to call transferGovernance() on all governable contracts.
// 3. Submit a proposal on the new governor to call claimGovernance() on all governable contracts.

const { isMainnet, isFork, isSmokeTest } = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const addresses = require("../utils/addresses");

const deployName = "018_upgrade_governor";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cThreePoolStrategyProxy = await ethers.getContract(
    "ThreePoolStrategyProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const cBuyback = await ethers.getContract("Buyback");
  const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
  const cCompensationClaim = await ethers.getContract("CompensationClaims");

  // Deploy a new governor contract.
  // The governor's admin is the guardian account (e.g. the multi-sig).
  // Set a min delay of 60sec for executing proposals.
  const dGovernor = await deployWithConfirmation("Governor", [
    addresses.mainnet.Guardian,
    60,
  ]);

  // Proposal for tranferring governance from the old to new governor.
  const propTransferDescription = "Transfer governance";
  const propTransferArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cVaultProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cThreePoolStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cAaveStrategyProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cBuyback,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cOGNStakingProxy,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
    {
      contract: cCompensationClaim,
      signature: "transferGovernance(address)",
      args: [dGovernor.address],
    },
  ]);

  // Proposal for claiming governance by the new governor.
  const propClaimDescription = "Claim governance";
  const propClaimArgs = await proposeArgs([
    {
      contract: cOUSDProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cVaultProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cThreePoolStrategyProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cAaveStrategyProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cBuyback,
      signature: "claimGovernance()",
    },
    {
      contract: cOGNStakingProxy,
      signature: "claimGovernance()",
    },
    {
      contract: cCompensationClaim,
      signature: "claimGovernance()",
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending transfer proposal to old governor...");
    await sendProposal(propTransferArgs, propTransferDescription, {
      governorAddr,
    });
    log("Transfer proposal sent.");

    log("Sending claim proposal to new governor...");
    await sendProposal(propClaimArgs, propClaimDescription);
    log("Claim proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing transfer proposal...");
    // Note: we send the proposal to the old governor by passing explicitly its address.
    await executeProposal(propTransferArgs, propTransferDescription, {
      governorAddr,
    });

    log("Sending and executing claim proposal...");
    await executeProposal(propClaimArgs, propClaimDescription, {
      guardianAddr: addresses.mainnet.Guardian,
    });
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
main.skip = () => !isMainnet || isSmokeTest || isFork;

module.exports = main;
