const { isMainnet, isFork } = require("../test/helpers.js");

const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");
const { proposeArgs } = require("../utils/governor");

const deployName = "005_compensation_claims";

//
// Deploys the new OUSD CompensationClaims contract.
//
const compensationClaimsDeploy = async ({ getNamedAccounts }) => {
  console.log(`Running ${deployName}...`);

  const { governorAddr, deployerAddr, adjusterAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  //
  // Deploy the contract.
  //
  const OUSD = await ethers.getContract("OUSDProxy");
  log(`Using OUSD address ${OUSD.address}`);
  log(`Using adjuster address ${adjusterAddr}`);

  await deployWithConfirmation("CompensationClaims", [
    OUSD.address,
    adjusterAddr,
  ]);

  const claimsContract = await ethers.getContract("CompensationClaims");

  //
  // Transfer governance of the CompensationClaims contract to the governor
  //

  await withConfirmation(
    claimsContract
      .connect(sDeployer)
      .transferGovernance(governorAddr, await getTxOpts())
  );
  log(`CompensationClaims transferGovernance(${governorAddr} called`);

  // Generate the governance proposal.
  const propDescription = "Claim ownership of CompensationClaims";
  const propArgs = await proposeArgs([
    {
      contract: claimsContract,
      signature: "claimGovernance()",
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
    // On other networks, claim governance using the governor account.
    await withConfirmation(claimsContract.connect(sGovernor).claimGovernance());
  }

  console.log(`${deployName} deploy done.`);
  return true;
};

compensationClaimsDeploy.id = deployName;
compensationClaimsDeploy.dependencies = ["core"];

/**
 * The contract is no longer in use and isn't expected to be updated
 */
compensationClaimsDeploy.skip = () => true;
compensationClaimsDeploy.tags = ["unit_tests"];

module.exports = compensationClaimsDeploy;
